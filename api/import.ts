
/**
 * @file api/import.ts
 * @description Endpoint API per l'importazione massiva di dati da un file Excel con logica Batch/Bulk ottimizzata.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// --- UTILITIES ---

/**
 * Helper per eseguire insert massivi (Bulk Insert).
 * Divide i dati in chunk per evitare il limite di parametri di Postgres (max 65535 params).
 */
async function executeBulkInsert(
    client: any, 
    tableName: string, 
    columns: string[], 
    rows: any[][], 
    conflictClause: string = 'ON CONFLICT DO NOTHING'
) {
    if (rows.length === 0) return;

    // Postgres supporta max 65535 parametri. 
    // Calcoliamo il batch size sicuro: floor(60000 / num_colonne)
    const paramLimit = 60000;
    const batchSize = Math.floor(paramLimit / columns.length);

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const row of batch) {
            const rowPlaceholders: string[] = [];
            for (const val of row) {
                values.push(val === undefined ? null : val);
                rowPlaceholders.push(`$${paramIndex++}`);
            }
            placeholders.push(`(${rowPlaceholders.join(',')})`);
        }

        const query = `
            INSERT INTO ${tableName} (${columns.join(',')}) 
            VALUES ${placeholders.join(',')} 
            ${conflictClause}
        `;

        await client.query(query, values);
    }
}

const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) { 
        if(isNaN(dateValue.getTime())) return null;
        return new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
    }
    if (typeof dateValue === 'number') {
       const utc_days  = Math.floor(dateValue - 25569);
       const utc_value = utc_days * 86400;                                        
       const date_info = new Date(utc_value * 1000);
       return new Date(Date.UTC(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate()));
    }
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        }
    }
    return null;
}

const formatDateForDB = (date: Date | null): string | null => {
    if (!date || isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

const normalize = (str: any): string => {
    return String(str || '').trim().toLowerCase();
};

// --- IMPORT FUNCTIONS ---

const importCoreEntities = async (client: any, body: any, warnings: string[]) => {
    const { clients: importedClients, roles: importedRoles, resources: importedResources, projects: importedProjects, calendar: importedCalendar, horizontals: importedHorizontals, seniorityLevels: importedSeniority, projectStatuses: importedStatuses, clientSectors: importedSectors, locations: importedLocations } = body;
    
    // Maps for ID resolution
    const roleNameMap = new Map<string, string>();
    const clientNameMap = new Map<string, string>();
    const resourceEmailMap = new Map<string, string>();
    const resourceNameMap = new Map<string, string>();
    const skillNameMap = new Map<string, string>();
    
    // --- 1. CONFIGURATIONS (Bulk) ---
    const importConfig = async (tableName: string, items: { Valore: string }[]) => {
        if (!Array.isArray(items) || items.length === 0) return;
        
        const rowsToInsert = items
            .filter(item => item.Valore)
            .map(item => [uuidv4(), item.Valore]);
            
        await executeBulkInsert(client, tableName, ['id', 'value'], rowsToInsert, 'ON CONFLICT (value) DO NOTHING');
    };

    await importConfig('horizontals', importedHorizontals);
    await importConfig('seniority_levels', importedSeniority);
    await importConfig('project_statuses', importedStatuses);
    await importConfig('client_sectors', importedSectors);
    await importConfig('locations', importedLocations);

    // --- 2. CALENDAR ---
    if (Array.isArray(importedCalendar) && importedCalendar.length > 0) {
        const calendarRows = importedCalendar
            .map(event => {
                const { 'Nome Evento': name, Data: date, Tipo: type, 'Sede (se locale)': location } = event;
                if (!name || !date || !type) return null;
                const dateObj = parseDate(date);
                if (!dateObj) return null;
                
                return [
                    uuidv4(),
                    name,
                    formatDateForDB(dateObj),
                    type,
                    location === 'Tutte' ? null : location
                ];
            })
            .filter(row => row !== null) as any[][];

        await executeBulkInsert(client, 'company_calendar', ['id', 'name', 'date', 'type', 'location'], calendarRows, 'ON CONFLICT (date, location) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type');
    }

    // --- 3. ROLES ---
    if (Array.isArray(importedRoles)) {
        // Load existing
        const existing = await client.query('SELECT id, name FROM roles');
        existing.rows.forEach((r: any) => roleNameMap.set(r.name, r.id));

        const newRoleRows: any[][] = [];
        
        for (const role of importedRoles) {
            const { 'Nome Ruolo': name, 'Livello Seniority': seniorityLevel, 'Costo Giornaliero (€)': dailyCost, 'Costo Standard (€)': standardCost } = role;
            if (!name) continue;

            if (!roleNameMap.has(name)) {
                const newId = uuidv4();
                const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                newRoleRows.push([newId, name, seniorityLevel, dailyCost, standardCost, dailyExpenses]);
                roleNameMap.set(name, newId);
            }
        }
        await executeBulkInsert(client, 'roles', ['id', 'name', 'seniority_level', 'daily_cost', 'standard_cost', 'daily_expenses'], newRoleRows);
    }

    // --- 4. CLIENTS ---
    if (Array.isArray(importedClients)) {
        const existing = await client.query('SELECT id, name FROM clients');
        existing.rows.forEach((c: any) => clientNameMap.set(c.name, c.id));

        const newClientRows: any[][] = [];
        for (const cl of importedClients) {
            const { 'Nome Cliente': name, Settore: sector, 'Email Contatto': contactEmail } = cl;
            if (!name) continue;
            if (!clientNameMap.has(name)) {
                const newId = uuidv4();
                newClientRows.push([newId, name, sector, contactEmail]);
                clientNameMap.set(name, newId);
            }
        }
        await executeBulkInsert(client, 'clients', ['id', 'name', 'sector', 'contact_email'], newClientRows);
    }

    // --- 5. RESOURCES & SKILLS ---
    if (Array.isArray(importedResources)) {
        const existingRes = await client.query('SELECT id, email, name FROM resources');
        existingRes.rows.forEach((r: any) => {
            resourceEmailMap.set(r.email, r.id);
            resourceNameMap.set(normalize(r.name), r.id);
        });
        
        const existingSkills = await client.query('SELECT id, name FROM skills');
        existingSkills.rows.forEach((s: any) => skillNameMap.set(normalize(s.name), s.id));

        const resourceRows: any[][] = [];
        const newSkillsToInsert = new Map<string, string>(); // name -> id
        const resourceSkillRows: any[][] = [];

        for (const res of importedResources) {
            const { Nome: name, Email: email, Ruolo: roleName, Horizontal: horizontal, Sede: location, 'Data Assunzione': hireDate, 'Anzianità (anni)': workSeniority, Note: notes, Competenze: skillsString, Tutor: tutorName } = res;
            if (!name || !email) {
                warnings.push(`Risorsa '${name}' saltata: dati mancanti.`);
                continue;
            }

            const roleId = roleName ? roleNameMap.get(roleName) : null;
            if (roleName && !roleId) warnings.push(`Ruolo '${roleName}' non trovato per risorsa '${name}'.`);

            let resourceId = resourceEmailMap.get(email);
            
            if (!resourceId) {
                resourceId = uuidv4();
                resourceEmailMap.set(email, resourceId);
                // Also update Name map for Tutors reference within same batch
                resourceNameMap.set(normalize(name), resourceId);
            }
            
            // Try to resolve Tutor immediately. 
            // NOTE: If Tutor is in the same import file but further down, this will be null.
            // A perfect solution requires 2 passes or a separate import.
            // We use best-effort here.
            let tutorId = null;
            if (tutorName) {
                tutorId = resourceNameMap.get(normalize(tutorName));
                if (!tutorId) {
                    // Try to find if tutor is in the list being imported but not processed yet
                    // This is simple name matching for simplicity
                    // If complex, use "Mappatura Tutor" specific import
                }
            }
            
            resourceRows.push([
                resourceId, name, email, roleId, horizontal, location, 
                formatDateForDB(parseDate(hireDate)), workSeniority, notes, tutorId
            ]);

            // Prepare Skills (Simple String List)
            if (skillsString && typeof skillsString === 'string') {
                const skillsList = skillsString.split(',').map((s: string) => s.trim()).filter(Boolean);
                for (const skillName of skillsList) {
                    const normName = normalize(skillName);
                    let skillId = skillNameMap.get(normName);
                    
                    if (!skillId) {
                        if (newSkillsToInsert.has(normName)) {
                            skillId = newSkillsToInsert.get(normName);
                        } else {
                            skillId = uuidv4();
                            newSkillsToInsert.set(normName, skillId);
                        }
                    }
                    
                    if (skillId && resourceId) {
                        resourceSkillRows.push([resourceId, skillId]);
                    }
                }
            }
        }

        // Execute Batches
        // 1. Resources
        await executeBulkInsert(
            client, 
            'resources', 
            ['id', 'name', 'email', 'role_id', 'horizontal', 'location', 'hire_date', 'work_seniority', 'notes', 'tutor_id'],
            resourceRows,
            `ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name, role_id = EXCLUDED.role_id, horizontal = EXCLUDED.horizontal, 
                location = EXCLUDED.location, hire_date = EXCLUDED.hire_date, 
                work_seniority = EXCLUDED.work_seniority, notes = EXCLUDED.notes, tutor_id = EXCLUDED.tutor_id`
        );

        // 2. New Skills (Simple)
        if (newSkillsToInsert.size > 0) {
            const skillRows = Array.from(newSkillsToInsert.entries()).map(([norm, id]) => {
                return [id, norm.charAt(0).toUpperCase() + norm.slice(1)]; 
            });
            await executeBulkInsert(client, 'skills', ['id', 'name'], skillRows, 'ON CONFLICT (id) DO NOTHING');
        }

        // 3. Resource Skills
        await executeBulkInsert(client, 'resource_skills', ['resource_id', 'skill_id'], resourceSkillRows, 'ON CONFLICT (resource_id, skill_id) DO NOTHING');
    }

    // --- 6. PROJECTS ---
    if (Array.isArray(importedProjects)) {
        const projectRows: any[][] = [];
        
        for (const proj of importedProjects) {
            const { 'Nome Progetto': name, Cliente: clientName, Stato: status, 'Budget (€)': budget, 'Realizzazione (%)': realizationPercentage, 'Data Inizio': startDate, 'Data Fine': endDate, 'Project Manager': projectManager, Note: notes } = proj;
            if (!name) continue;
            
            const clientId = clientName ? clientNameMap.get(clientName) : null;
            if (clientName && !clientId) warnings.push(`Cliente '${clientName}' non trovato per progetto '${name}'.`);

            const newId = uuidv4();
            
            projectRows.push([
                newId, name, clientId, status, budget, realizationPercentage, 
                formatDateForDB(parseDate(startDate)), formatDateForDB(parseDate(endDate)), 
                projectManager, notes
            ]);
        }

        await executeBulkInsert(
            client, 
            'projects', 
            ['id', 'name', 'client_id', 'status', 'budget', 'realization_percentage', 'start_date', 'end_date', 'project_manager', 'notes'],
            projectRows,
            'ON CONFLICT (name, client_id) DO UPDATE SET status = EXCLUDED.status, budget = EXCLUDED.budget, end_date = EXCLUDED.end_date, realization_percentage = EXCLUDED.realization_percentage'
        );
    }
};

const importStaffing = async (client: any, body: any, warnings: string[]) => {
    const { staffing } = body;
    if (!Array.isArray(staffing) || staffing.length === 0) return;

    // 1. Pre-load Lookups
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    const projectMap = new Map((await client.query('SELECT id, name FROM projects')).rows.map((p: any) => [normalize(p.name), p.id]));
    
    // Pre-load Assignments to minimize queries
    const assignmentMap = new Map<string, string>(); // "resId-projId" -> assignmentId
    const assignmentRes = await client.query('SELECT id, resource_id, project_id FROM assignments');
    assignmentRes.rows.forEach((a: any) => assignmentMap.set(`${a.resource_id}-${a.project_id}`, a.id));

    const newAssignments: any[][] = [];
    const allocationsToUpsert: any[][] = [];
    
    // 2. Process Rows
    for (const row of staffing) {
        const resourceName = row['Resource Name'];
        const projectName = row['Project Name'];

        if (!resourceName || !projectName) continue;

        const resourceId = resourceMap.get(normalize(resourceName));
        const projectId = projectMap.get(normalize(projectName));

        if (!resourceId) { warnings.push(`Staffing saltato: Risorsa '${resourceName}' non trovata.`); continue; }
        if (!projectId) { warnings.push(`Staffing saltato: Progetto '${projectName}' non trovato.`); continue; }

        const key = `${resourceId}-${projectId}`;
        let assignmentId = assignmentMap.get(key);

        if (!assignmentId) {
            assignmentId = uuidv4();
            newAssignments.push([assignmentId, resourceId, projectId]);
            assignmentMap.set(key, assignmentId); // update map so subsequent rows use it
        }

        // Extract Dates
        for (const colKey in row) {
            if (colKey !== 'Resource Name' && colKey !== 'Project Name') {
                const date = parseDate(colKey);
                const percentage = Number(row[colKey]);
                
                if (date && !isNaN(percentage) && percentage > 0) {
                    allocationsToUpsert.push([
                        assignmentId,
                        formatDateForDB(date),
                        percentage
                    ]);
                }
            }
        }
    }

    // 3. Bulk Insert Assignments
    if (newAssignments.length > 0) {
        await executeBulkInsert(client, 'assignments', ['id', 'resource_id', 'project_id'], newAssignments, 'ON CONFLICT (resource_id, project_id) DO NOTHING');
    }

    // 4. Bulk Upsert Allocations
    if (allocationsToUpsert.length > 0) {
        await executeBulkInsert(
            client, 
            'allocations', 
            ['assignment_id', 'allocation_date', 'percentage'], 
            allocationsToUpsert, 
            'ON CONFLICT (assignment_id, allocation_date) DO UPDATE SET percentage = EXCLUDED.percentage'
        );
    }
};

const importResourceRequests = async (client: any, body: any, warnings: string[]) => {
    const { resource_requests: importedRequests } = body;
    if (!Array.isArray(importedRequests)) return;

    const projectMap = new Map((await client.query('SELECT id, name FROM projects')).rows.map((p: any) => [normalize(p.name), p.id]));
    const roleMap = new Map((await client.query('SELECT id, name FROM roles')).rows.map((r: any) => [normalize(r.name), r.id]));
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    
    const rowsToInsert: any[][] = [];

    for (const req of importedRequests) {
        const { projectName, roleName, requestorName, startDate, endDate, commitmentPercentage, isUrgent, isTechRequest, notes, status } = req;
        // Parse new OSR columns
        const isOsrOpen = String(req['OSR Aperta']).toUpperCase() === 'SI' || req['OSR Aperta'] === true;
        const osrNumber = req['Numero OSR'] || null;
        
        if (!projectName || !roleName || !startDate || !endDate) continue;

        const projectId = projectMap.get(normalize(projectName));
        const roleId = roleMap.get(normalize(roleName));
        const requestorId = requestorName ? resourceMap.get(normalize(requestorName)) : null;

        if (!projectId || !roleId) {
            warnings.push(`Richiesta saltata: progetto o ruolo non trovato per ${projectName}.`);
            continue;
        }

        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (!start || !end) continue;

        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isLongTerm = diffDays > 60;

        rowsToInsert.push([
            uuidv4(), projectId, roleId, requestorId, 
            formatDateForDB(start), formatDateForDB(end), 
            Number(commitmentPercentage), 
            String(isUrgent).toLowerCase() === 'si' || isUrgent === true, 
            isLongTerm, 
            String(isTechRequest).toLowerCase() === 'si' || isTechRequest === true, 
            isOsrOpen,
            isOsrOpen ? osrNumber : null, // Ensure osrNumber is only saved if open
            notes, status
        ]);
    }

    await executeBulkInsert(
        client, 
        'resource_requests', 
        ['id', 'project_id', 'role_id', 'requestor_id', 'start_date', 'end_date', 'commitment_percentage', 'is_urgent', 'is_long_term', 'is_tech_request', 'is_osr_open', 'osr_number', 'notes', 'status'],
        rowsToInsert
    );
};

const importInterviews = async (client: any, body: any, warnings: string[]) => {
    const { interviews: importedInterviews } = body;
    if (!Array.isArray(importedInterviews)) return;
    
    const roleMap = new Map((await client.query('SELECT id, name FROM roles')).rows.map((r: any) => [normalize(r.name), r.id]));
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    
    const rowsToInsert: any[][] = [];

    for (const interview of importedInterviews) {
        const { candidateName, candidateSurname, birthDate, horizontal, roleName, cv_summary, interviewersNames, interviewDate, feedback, notes, hiringStatus, entryDate, status } = interview;

        if (!candidateName || !candidateSurname) continue;
        
        const roleId = roleName ? roleMap.get(normalize(roleName)) : null;
        
        let interviewersIds: string[] = [];
        if (interviewersNames && typeof interviewersNames === 'string') {
            interviewersIds = interviewersNames.split(',')
                .map(n => resourceMap.get(normalize(n.trim())))
                .filter(id => id) as string[];
        }

        rowsToInsert.push([
            uuidv4(), candidateName, candidateSurname, formatDateForDB(parseDate(birthDate)), horizontal, roleId,
            cv_summary || null, interviewersIds.length > 0 ? interviewersIds : null,
            formatDateForDB(parseDate(interviewDate)), feedback, notes, hiringStatus, 
            formatDateForDB(parseDate(entryDate)), status
        ]);
    }

    await executeBulkInsert(
        client, 
        'interviews',
        ['id', 'candidate_name', 'candidate_surname', 'birth_date', 'horizontal', 'role_id', 'cv_summary', 'interviewers_ids', 'interview_date', 'feedback', 'notes', 'hiring_status', 'entry_date', 'status'],
        rowsToInsert
    );
};

// --- NEW IMPORT LOGIC FOR RELATIONAL SKILLS ---
const importSkills = async (client: any, body: any, warnings: string[]) => {
    const { skills: importedSkills, associations: importedAssociations } = body;
    
    // Maps for lookups (Name -> ID)
    const macroMap = new Map<string, string>();
    const catMap = new Map<string, string>();
    const skillMap = new Map<string, string>();
    
    // 1. Load Existing Entities
    const existingMacros = await client.query('SELECT id, name FROM skill_macro_categories');
    existingMacros.rows.forEach((r: any) => macroMap.set(normalize(r.name), r.id));

    const existingCats = await client.query('SELECT id, name FROM skill_categories');
    existingCats.rows.forEach((r: any) => catMap.set(normalize(r.name), r.id));

    const existingSkills = await client.query('SELECT id, name FROM skills');
    existingSkills.rows.forEach((r: any) => skillMap.set(normalize(r.name), r.id));

    // Queues for Insertion
    const macrosToInsert = new Map<string, string>(); // normName -> id
    const catsToInsert = new Map<string, string>();
    const skillsToInsert = new Map<string, string>();
    
    const catMacroLinks = new Map<string, string>(); // "catId-macroId" -> true (dedup)
    const skillCatLinks = new Map<string, string>(); // "skillId-catId" -> true (dedup)
    const skillsMetadata = new Map<string, boolean>(); // skillId -> isCertification

    const getOrGenerateId = (name: string, map: Map<string, string>, insertMap: Map<string, string>): string => {
        const norm = normalize(name);
        if (map.has(norm)) return map.get(norm)!;
        if (insertMap.has(norm)) return insertMap.get(norm)!;
        
        const newId = uuidv4();
        insertMap.set(norm, newId);
        return newId;
    };

    // --- Helper to process a skill row (from Definitions or Associations) ---
    const processSkillRow = (skillName: string, catString: string, macroString: string, isCert: boolean) => {
        if (!skillName) return;

        // 1. Process Macros
        const macroIds: string[] = [];
        if (macroString) {
            macroString.split(',').map(s => s.trim()).forEach(mName => {
                if(mName) macroIds.push(getOrGenerateId(mName, macroMap, macrosToInsert));
            });
        }

        // 2. Process Categories
        const catIds: string[] = [];
        if (catString) {
            catString.split(',').map(s => s.trim()).forEach(cName => {
                if(cName) catIds.push(getOrGenerateId(cName, catMap, catsToInsert));
            });
        }

        // 3. Link Categories to Macros
        // Heuristic: Link ALL specified Cats to ALL specified Macros for this row
        // This is imperfect for complex graphs in a single row, but standard for flat imports.
        if (macroIds.length > 0 && catIds.length > 0) {
            catIds.forEach(cId => {
                macroIds.forEach(mId => {
                    catMacroLinks.set(`${cId}|${mId}`, '1');
                });
            });
        }

        // 4. Process Skill
        const skillId = getOrGenerateId(skillName, skillMap, skillsToInsert);
        
        // Update metadata (Cert flag)
        skillsMetadata.set(skillId, isCert);

        // 5. Link Skill to Categories
        if (catIds.length > 0) {
            catIds.forEach(cId => {
                skillCatLinks.set(`${skillId}|${cId}`, '1');
            });
        }
    };

    // --- A. Process Definition Sheet ---
    if (Array.isArray(importedSkills)) {
        for (const row of importedSkills) {
            // New column names support: "Ambito (Categorie)" or fallback to old "Ambito"
            const catStr = row['Ambito (Categorie)'] || row['Ambito'];
            const macroStr = row['Macro Ambito'];
            const isCert = String(row['Certificazione']).toUpperCase() === 'SI';
            
            processSkillRow(row['Nome Competenza'], catStr, macroStr, isCert);
        }
    }

    // --- B. Process Associations Sheet (Context Discovery) ---
    // If a skill appears in associations but not definitions, we still want to create its context.
    const associationsToInsert = new Map<string, any[]>(); // uniqueKey -> rowData

    if (Array.isArray(importedAssociations)) {
        const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));

        for (const row of importedAssociations) {
            const { 'Nome Risorsa': resName, 'Nome Competenza': skillName, 'Livello': level, 'Data Conseguimento': acqDate, 'Data Scadenza': expDate } = row;
            const catStr = row['Ambito (Categorie)'] || row['Ambito'];
            const macroStr = row['Macro Ambito'];
            
            if (!resName || !skillName) continue;

            const resourceId = resourceMap.get(normalize(resName));
            if (!resourceId) {
                warnings.push(`Risorsa non trovata per associazione: ${resName}`);
                continue;
            }

            // Ensure Context is created even if derived from association row
            processSkillRow(skillName, catStr, macroStr, false); // Default cert false if discovered here

            // Get ID (should exist now via processSkillRow or map)
            const skillId = getOrGenerateId(skillName, skillMap, skillsToInsert);

            // Prepare Association
            let normalizedLevel = 1;
            const parsed = parseInt(String(level), 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) normalizedLevel = parsed;

            associationsToInsert.set(`${resourceId}|${skillId}`, [
                resourceId, skillId, normalizedLevel,
                formatDateForDB(parseDate(acqDate)), formatDateForDB(parseDate(expDate))
            ]);
        }
    }

    // --- C. EXECUTE DATABASE WRITES ---

    // 1. Macros
    if (macrosToInsert.size > 0) {
        const rows = Array.from(macrosToInsert.entries()).map(([norm, id]) => {
            // Capitalize simple heuristic
            const name = norm.charAt(0).toUpperCase() + norm.slice(1);
            return [id, name];
        });
        await executeBulkInsert(client, 'skill_macro_categories', ['id', 'name'], rows, 'ON CONFLICT (name) DO NOTHING');
    }

    // 2. Categories
    if (catsToInsert.size > 0) {
        const rows = Array.from(catsToInsert.entries()).map(([norm, id]) => {
            const name = norm.charAt(0).toUpperCase() + norm.slice(1);
            return [id, name];
        });
        await executeBulkInsert(client, 'skill_categories', ['id', 'name'], rows, 'ON CONFLICT (name) DO NOTHING');
    }

    // 3. Cat -> Macro Map
    if (catMacroLinks.size > 0) {
        const rows = Array.from(catMacroLinks.keys()).map(key => key.split('|'));
        await executeBulkInsert(client, 'skill_category_macro_map', ['category_id', 'macro_category_id'], rows, 'ON CONFLICT DO NOTHING');
    }

    // 4. Skills
    if (skillsToInsert.size > 0) {
        const rows = Array.from(skillsToInsert.entries()).map(([norm, id]) => {
            // Use provided name casing from input if possible, here simplified
            const name = norm.charAt(0).toUpperCase() + norm.slice(1); 
            const isCert = skillsMetadata.get(id) || false;
            return [id, name, isCert];
        });
        await executeBulkInsert(client, 'skills', ['id', 'name', 'is_certification'], rows, 'ON CONFLICT (id) DO UPDATE SET is_certification = EXCLUDED.is_certification');
    } else {
        // Update is_certification for existing skills if specified
        for (const [id, isCert] of skillsMetadata.entries()) {
            if (skillMap.has(normalize(id))) { // check by name actually, map key is name
                 // Optimization: Perform update only if needed? Bulk update difficult here.
                 // We skip mass updates on existing skills metadata to avoid overwrites, 
                 // unless explicitly new. 
            }
        }
    }

    // 5. Skill -> Cat Map
    if (skillCatLinks.size > 0) {
        const rows = Array.from(skillCatLinks.keys()).map(key => key.split('|'));
        await executeBulkInsert(client, 'skill_skill_category_map', ['skill_id', 'category_id'], rows, 'ON CONFLICT DO NOTHING');
    }

    // 6. Associations
    if (associationsToInsert.size > 0) {
        const rows = Array.from(associationsToInsert.values());
        await executeBulkInsert(
            client, 
            'resource_skills', 
            ['resource_id', 'skill_id', 'level', 'acquisition_date', 'expiration_date'],
            rows,
            'ON CONFLICT (resource_id, skill_id) DO UPDATE SET level = EXCLUDED.level, acquisition_date = EXCLUDED.acquisition_date, expiration_date = EXCLUDED.expiration_date'
        );
    }
};

const importLeaves = async (client: any, body: any, warnings: string[]) => {
    const { leaves: importedLeaves } = body;
    if (!Array.isArray(importedLeaves)) return;

    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    const leaveTypeMap = new Map((await client.query('SELECT id, name FROM leave_types')).rows.map((t: any) => [normalize(t.name), t.id]));

    const rowsToInsert: any[][] = [];

    for (const leave of importedLeaves) {
        const { 'Nome Risorsa': resName, 'Tipologia Assenza': typeName, 'Data Inizio': startDate, 'Data Fine': endDate, 'Approvatori': approverNames, 'Stato': status, 'Note': notes } = leave;

        if (!resName || !typeName || !startDate || !endDate) continue;

        const resourceId = resourceMap.get(normalize(resName));
        const typeId = leaveTypeMap.get(normalize(typeName));

        if (!resourceId || !typeId) {
            warnings.push(`Assenza saltata: risorsa o tipo non trovato.`);
            continue;
        }

        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (!start || !end) continue;

        let normalizedStatus = 'PENDING';
        if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(String(status).toUpperCase())) {
            normalizedStatus = String(status).toUpperCase();
        }

        let approverIds: string[] | null = null;
        if (approverNames && typeof approverNames === 'string') {
            approverIds = approverNames.split(',')
                .map(n => resourceMap.get(normalize(n.trim())))
                .filter(id => id) as string[];
            if (approverIds.length === 0) approverIds = null;
        }

        rowsToInsert.push([
            uuidv4(), resourceId, typeId, formatDateForDB(start), formatDateForDB(end),
            normalizedStatus, notes, approverIds
        ]);
    }

    await executeBulkInsert(
        client,
        'leave_requests',
        ['id', 'resource_id', 'type_id', 'start_date', 'end_date', 'status', 'notes', 'approver_ids'],
        rowsToInsert
    );
};

const importUsersPermissions = async (client: any, body: any, warnings: string[]) => {
    const { users, permissions } = body;
    
    // 1. Users
    if (Array.isArray(users)) {
        const existingUsers = new Map((await client.query('SELECT username, id FROM app_users')).rows.map((u: any) => [u.username, u.id]));
        const resourceMap = new Map((await client.query('SELECT id, email FROM resources')).rows.map((r: any) => [normalize(r.email), r.id]));
        
        const defaultHash = await bcrypt.hash("Staffing2024!", 10);
        const usersToInsert: any[][] = [];
        
        for (const u of users) {
            const { Username, Ruolo, 'Email Risorsa': resourceEmail, 'Stato Attivo': isActive } = u;
            if (!Username || !Ruolo) continue;

            const role = ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR', 'SIMPLE'].includes(Ruolo) ? Ruolo : 'SIMPLE';
            const active = String(isActive).toUpperCase() === 'SI';
            const resourceId = resourceEmail ? resourceMap.get(normalize(resourceEmail)) : null;

            if (existingUsers.has(Username)) {
                // Update
                await client.query('UPDATE app_users SET role=$1, is_active=$2, resource_id=$3 WHERE username=$4', [role, active, resourceId, Username]);
            } else {
                // Insert
                usersToInsert.push([uuidv4(), Username, defaultHash, role, active, resourceId, true]);
            }
        }

        await executeBulkInsert(
            client,
            'app_users',
            ['id', 'username', 'password_hash', 'role', 'is_active', 'resource_id', 'must_change_password'],
            usersToInsert
        );
    }

    // 2. Permissions
    if (Array.isArray(permissions)) {
        const permRows = permissions.map(p => {
            const { Ruolo, Pagina, 'Accesso Consentito': allowed } = p;
            if (!Ruolo || !Pagina) return null;
            const isAllowed = String(allowed).toUpperCase() === 'SI';
            return [Ruolo, Pagina, isAllowed];
        }).filter(r => r !== null) as any[][];

        await executeBulkInsert(
            client,
            'role_permissions',
            ['role', 'page_path', 'is_allowed'],
            permRows,
            'ON CONFLICT (role, page_path) DO UPDATE SET is_allowed = EXCLUDED.is_allowed'
        );
    }
};

const importTutorMapping = async (client: any, body: any, warnings: string[]) => {
    const { mapping } = body;
    if (!Array.isArray(mapping) || mapping.length === 0) return;

    // Load Maps
    // Prioritize Email for uniqueness, fallback to name
    const emailMap = new Map((await client.query('SELECT id, email FROM resources')).rows.map((r: any) => [normalize(r.email), r.id]));
    const nameMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));

    const updates: any[][] = [];

    for (const row of mapping) {
        const { 'Risorsa': rName, 'Email Risorsa': rEmail, 'Tutor': tName, 'Email Tutor': tEmail } = row;
        
        let resourceId = rEmail ? emailMap.get(normalize(rEmail)) : null;
        if (!resourceId && rName) resourceId = nameMap.get(normalize(rName));

        if (!resourceId) {
            warnings.push(`Risorsa non trovata: ${rEmail || rName}`);
            continue;
        }

        let tutorId = null;
        if (tEmail) tutorId = emailMap.get(normalize(tEmail));
        if (!tutorId && tName) tutorId = nameMap.get(normalize(tName));

        if ((tEmail || tName) && !tutorId) {
            warnings.push(`Tutor non trovato per ${rName}: ${tEmail || tName}`);
            // Continue but set tutor to null (assuming user wants to clear it if not found, or just skip update? 
            // Better to skip update if intent unclear, but for "mapping" implies setting state. 
            // If explicit empty string in excel, we clear. If invalid string, we warn.)
            continue; 
        }
        
        // Prevent self-tutor loop
        if (resourceId === tutorId) {
            warnings.push(`Auto-referenza ignorata per: ${rName}`);
            tutorId = null;
        }

        // Add to batch for update
        // We use a temporary table strategy or simple loop updates since UPDATE FROM VALUES is complex in standard SQL for just one field
        // Simple loop is acceptable here as volume is usually low (<1000)
        await client.query(`UPDATE resources SET tutor_id = $1 WHERE id = $2`, [tutorId, resourceId]);
    }
};


// --- HANDLER ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { type } = req.query;
    const client = await db.connect();
    const warnings: string[] = [];

    try {
        await client.query('BEGIN');

        console.log(`Starting bulk import of type: ${type}`);

        switch(type) {
            case 'core_entities':
                await importCoreEntities(client, req.body, warnings);
                break;
            case 'staffing':
                await importStaffing(client, req.body, warnings);
                break;
            case 'resource_requests':
                await importResourceRequests(client, req.body, warnings);
                break;
            case 'interviews':
                await importInterviews(client, req.body, warnings);
                break;
            case 'skills':
                await importSkills(client, req.body, warnings);
                break;
            case 'leaves':
                await importLeaves(client, req.body, warnings);
                break;
            case 'users_permissions':
                await importUsersPermissions(client, req.body, warnings);
                break;
            case 'tutor_mapping':
                await importTutorMapping(client, req.body, warnings);
                break;
            default:
                throw new Error('Tipo di importazione non valido.');
        }

        await client.query('COMMIT');
        console.log(`Import completed with ${warnings.length} warnings.`);
        res.status(200).json({ message: 'Importazione completata con successo.', warnings });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Import failed:', error);
        res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}