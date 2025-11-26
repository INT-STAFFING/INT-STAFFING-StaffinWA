

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
    const skillNameMap = new Map<string, string>();
    
    // --- 1. CONFIGURATIONS (Bulk) ---
    const importConfig = async (tableName: string, items: { Valore: string }[]) => {
        if (!Array.isArray(items) || items.length === 0) return;
        
        // Pre-fetch existing to avoid ID churn (though ON CONFLICT handles uniqueness, we need stable IDs if referenced elsewhere, not here though)
        // For config tables, just insert new ones.
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
            } else {
                // Optional: Update logic could go here if needed via separate UPDATE or Upsert
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
        const existingRes = await client.query('SELECT id, email FROM resources');
        existingRes.rows.forEach((r: any) => resourceEmailMap.set(r.email, r.id));
        
        // Pre-load skills
        const existingSkills = await client.query('SELECT id, name FROM skills');
        existingSkills.rows.forEach((s: any) => skillNameMap.set(normalize(s.name), s.id));

        const resourceRows: any[][] = [];
        const newSkillsToInsert = new Map<string, string>(); // name -> id
        const resourceSkillRows: any[][] = [];

        for (const res of importedResources) {
            const { Nome: name, Email: email, Ruolo: roleName, Horizontal: horizontal, Sede: location, 'Data Assunzione': hireDate, 'Anzianità (anni)': workSeniority, Note: notes, Competenze: skillsString } = res;
            if (!name || !email) {
                warnings.push(`Risorsa '${name}' saltata: dati mancanti.`);
                continue;
            }

            const roleId = roleName ? roleNameMap.get(roleName) : null;
            if (roleName && !roleId) warnings.push(`Ruolo '${roleName}' non trovato per risorsa '${name}'.`);

            let resourceId = resourceEmailMap.get(email);
            
            // Prepare Resource Row (Upsert)
            if (!resourceId) {
                resourceId = uuidv4();
                resourceEmailMap.set(email, resourceId);
            }
            
            resourceRows.push([
                resourceId, name, email, roleId, horizontal, location, 
                formatDateForDB(parseDate(hireDate)), workSeniority, notes
            ]);

            // Prepare Skills
            if (skillsString && typeof skillsString === 'string') {
                const skillsList = skillsString.split(',').map((s: string) => s.trim()).filter(Boolean);
                for (const skillName of skillsList) {
                    const normName = normalize(skillName);
                    let skillId = skillNameMap.get(normName);
                    
                    if (!skillId) {
                        // Check if we already queued it for creation
                        if (newSkillsToInsert.has(normName)) {
                            skillId = newSkillsToInsert.get(normName);
                        } else {
                            skillId = uuidv4();
                            newSkillsToInsert.set(normName, skillId);
                            // Note: We store original casing in DB, but lookup normalized
                            // Here we just use the first occurrence casing
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
            ['id', 'name', 'email', 'role_id', 'horizontal', 'location', 'hire_date', 'work_seniority', 'notes'],
            resourceRows,
            `ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name, role_id = EXCLUDED.role_id, horizontal = EXCLUDED.horizontal, 
                location = EXCLUDED.location, hire_date = EXCLUDED.hire_date, 
                work_seniority = EXCLUDED.work_seniority, notes = EXCLUDED.notes`
        );

        // 2. New Skills
        if (newSkillsToInsert.size > 0) {
            const skillRows = Array.from(newSkillsToInsert.entries()).map(([norm, id]) => {
                // Try to find original casing from input if possible, or just capitalize
                return [id, norm.charAt(0).toUpperCase() + norm.slice(1)]; 
            });
            await executeBulkInsert(client, 'skills', ['id', 'name'], skillRows, 'ON CONFLICT (name) DO NOTHING');
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

            // We generate ID based on uniqueness to allow idempotent runs if needed, 
            // but here we just insert new ones. For updates, we'd need to lookup existing projects.
            // Let's assume names+client are unique enough or we query first.
            // Optimisation: Just try Insert.
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
            notes, status
        ]);
    }

    await executeBulkInsert(
        client, 
        'resource_requests', 
        ['id', 'project_id', 'role_id', 'requestor_id', 'start_date', 'end_date', 'commitment_percentage', 'is_urgent', 'is_long_term', 'is_tech_request', 'notes', 'status'],
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

const importSkills = async (client: any, body: any, warnings: string[]) => {
    const { skills: importedSkills, associations: importedAssociations } = body;
    const skillNameMap = new Map<string, string>(); // normalized name -> id
    const skillDefinitions = new Map<string, any>(); // id -> { ...cols } to ensure unique rows for skills table

    // 1. Load existing skills
    const existingSkills = await client.query('SELECT id, name FROM skills');
    existingSkills.rows.forEach((s: any) => skillNameMap.set(normalize(s.name), s.id));

    // 2. Process Definitions (Sheet 1)
    if (Array.isArray(importedSkills)) {
        for (const s of importedSkills) {
            const { 'Nome Competenza': name, 'Ambito': category, 'Macro Ambito': macroCategory, Certificazione: isCert } = s;
            if (!name) continue;
            const normalized = normalize(name);
            const isCertification = String(isCert).toUpperCase() === 'SI';

            let id = skillNameMap.get(normalized);
            if (!id) {
                id = uuidv4();
                skillNameMap.set(normalized, id);
            }
            // Always overwrite/set definition based on import
            skillDefinitions.set(id, [id, String(name).trim(), category, macroCategory, isCertification]);
        }
    }

    // 3. Process Associations (Sheet 2) to find missing skills
    const assocRows: any[][] = [];
    
    if (Array.isArray(importedAssociations)) {
        const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));

        for (const assoc of importedAssociations) {
             const { 'Nome Risorsa': resName, 'Nome Competenza': skillName, 'Livello': level, 'Data Conseguimento': acqDate, 'Data Scadenza': expDate, 'Ambito': category, 'Macro Ambito': macroCategory } = assoc;
             
             if (!resName || !skillName) continue;
             
             const resourceId = resourceMap.get(normalize(resName));
             const normalizedSkill = normalize(skillName);
             let skillId = skillNameMap.get(normalizedSkill);

             // If skill doesn't exist yet, create it from Association data
             if (!skillId) {
                 skillId = uuidv4();
                 skillNameMap.set(normalizedSkill, skillId);
                 // Default isCertification to false.
                 skillDefinitions.set(skillId, [skillId, String(skillName).trim(), category || null, macroCategory || null, false]);
             } else {
                 // If skill exists but wasn't in the Definitions sheet, update it if we have context info
                 if (!skillDefinitions.has(skillId) && (category || macroCategory)) {
                     skillDefinitions.set(skillId, [skillId, String(skillName).trim(), category || null, macroCategory || null, false]); 
                 }
             }
             
             if (resourceId && skillId) {
                 let normalizedLevel = 1;
                 const parsed = parseInt(String(level), 10);
                 if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) normalizedLevel = parsed;

                 assocRows.push([
                     resourceId, skillId, normalizedLevel, 
                     formatDateForDB(parseDate(acqDate)), formatDateForDB(parseDate(expDate))
                 ]);
             }
        }
    }

    // 4. Execute Skills Upsert (Merging definitions from both sheets)
    if (skillDefinitions.size > 0) {
        const skillRows = Array.from(skillDefinitions.values());
        await executeBulkInsert(
            client, 
            'skills', 
            ['id', 'name', 'category', 'macro_category', 'is_certification'], 
            skillRows,
            `ON CONFLICT (id) DO UPDATE SET 
                category = COALESCE(EXCLUDED.category, skills.category), 
                macro_category = COALESCE(EXCLUDED.macro_category, skills.macro_category), 
                is_certification = COALESCE(EXCLUDED.is_certification, skills.is_certification)`
        );
    }

    // 5. Execute Associations Upsert
    if (assocRows.length > 0) {
        await executeBulkInsert(
            client, 
            'resource_skills', 
            ['resource_id', 'skill_id', 'level', 'acquisition_date', 'expiration_date'],
            assocRows,
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
        const usersToUpdate: any[][] = []; // Can't bulk update disparate rows easily without temp table, so we iterate updates or use specific query structure.
        // For updates, we fallback to loop or complex CTE. Given users count is low, loop is OK, but let's try to be efficient.
        
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