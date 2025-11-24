/**
 * @file api/import.ts
 * @description Endpoint API per l'importazione massiva di dati da un file Excel.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

/**
 * Esegue il parsing di un valore data proveniente da Excel, gestendo sia i numeri seriali
 * che i formati stringa comuni, e lo converte in un oggetto Date JavaScript.
 * La conversione viene fatta in UTC per evitare problemi di fuso orario.
 * @param {any} dateValue - Il valore della cella Excel da parsare (può essere numero o stringa).
 * @returns {Date | null} Un oggetto Date in UTC o null se il valore non è valido.
 */
const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) { // Already a date object from cellDates:true
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

/**
 * Formatta un oggetto Date nel formato stringa "YYYY-MM-DD" richiesto dal database.
 * @param {Date | null} date - L'oggetto Date da formattare.
 * @returns {string | null} La data formattata o null se l'input è nullo.
 */
const formatDateForDB = (date: Date | null): string | null => {
    if (!date || isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

/**
 * Normalizza una stringa per confronti sicuri (trim + lowercase).
 */
const normalize = (str: any): string => {
    return String(str || '').trim().toLowerCase();
};

const importCoreEntities = async (client: any, body: any, warnings: string[]) => {
    const { clients: importedClients, roles: importedRoles, resources: importedResources, projects: importedProjects, calendar: importedCalendar, horizontals: importedHorizontals, seniorityLevels: importedSeniority, projectStatuses: importedStatuses, clientSectors: importedSectors, locations: importedLocations } = body;
    const roleNameMap = new Map<string, string>();
    const clientNameMap = new Map<string, string>();
    const resourceEmailMap = new Map<string, string>();
    const locationValueMap = new Map<string, string>();
    const skillNameMap = new Map<string, string>();
    
    // 1. Import Configs
    const importConfig = async (tableName: string, items: { Valore: string }[], map?: Map<string, string>, label: string = 'Configurazione') => {
        if (!Array.isArray(items)) return;
        const existing = await client.query(`SELECT id, value FROM ${tableName}`);
        existing.rows.forEach((item: { value: string; id: string; }) => map?.set(item.value, item.id));

        for (const item of items) {
            const value = item.Valore;
            if (!value) { warnings.push(`${label}: una riga è stata saltata perché non ha un valore.`); continue; }
            if (map ? map.has(value) : existing.rows.some((r: { value: string; }) => r.value === value)) { 
                // warnings.push(`${label} '${value}' già esistente, saltato.`);
            } else {
                const newId = uuidv4();
                await client.query(`INSERT INTO ${tableName} (id, value) VALUES ($1, $2)`, [newId, value]);
                if (map) map.set(value, newId);
            }
        }
    };

    await importConfig('horizontals', importedHorizontals, undefined, 'Horizontal');
    await importConfig('seniority_levels', importedSeniority, undefined, 'Seniority Level');
    await importConfig('project_statuses', importedStatuses, undefined, 'Stato Progetto');
    await importConfig('client_sectors', importedSectors, undefined, 'Settore Cliente');
    await importConfig('locations', importedLocations, locationValueMap, 'Sede');

    // 2. Import Calendar
    if (Array.isArray(importedCalendar)) {
        for (const event of importedCalendar) {
            const { 'Nome Evento': name, Data: date, Tipo: type, 'Sede (se locale)': location } = event;
            if (!name || !date || !type) continue;
            
            const dateObj = parseDate(date);
            if (!dateObj) continue;
            const dateStr = formatDateForDB(dateObj);

            const existing = await client.query('SELECT id FROM company_calendar WHERE date = $1 AND location IS NOT DISTINCT FROM $2', [dateStr, location === 'Tutte' ? null : location]);
            if (existing.rows.length === 0) {
                const newId = uuidv4();
                await client.query(
                    'INSERT INTO company_calendar (id, name, date, type, location) VALUES ($1, $2, $3, $4, $5)',
                    [newId, name, dateStr, type, location === 'Tutte' ? null : location]
                );
            }
        }
    }
    
    // 3. Import Roles
    if (Array.isArray(importedRoles)) {
        const existingRoles = await client.query('SELECT id, name FROM roles');
        existingRoles.rows.forEach((r: { name: string; id: string; }) => roleNameMap.set(r.name, r.id));

        for (const role of importedRoles) {
            const { 'Nome Ruolo': name, 'Livello Seniority': seniorityLevel, 'Costo Giornaliero (€)': dailyCost, 'Costo Standard (€)': standardCost } = role;
            if (!name) continue;

            if (!roleNameMap.has(name)) {
                const newId = uuidv4();
                const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                await client.query(
                    'INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES ($1, $2, $3, $4, $5, $6)',
                    [newId, name, seniorityLevel, dailyCost, standardCost, dailyExpenses]
                );
                roleNameMap.set(name, newId);
            }
        }
    }

    // 4. Import Clients
    if (Array.isArray(importedClients)) {
        const existingClients = await client.query('SELECT id, name FROM clients');
        existingClients.rows.forEach((c: { name: string; id: string; }) => clientNameMap.set(c.name, c.id));

        for (const cl of importedClients) {
            const { 'Nome Cliente': name, Settore: sector, 'Email Contatto': contactEmail } = cl;
            if (!name) continue;

            if (!clientNameMap.has(name)) {
                const newId = uuidv4();
                await client.query(
                    'INSERT INTO clients (id, name, sector, contact_email) VALUES ($1, $2, $3, $4)',
                    [newId, name, sector, contactEmail]
                );
                clientNameMap.set(name, newId);
            }
        }
    }

    // 5. Import Resources (and Skills)
    if (Array.isArray(importedResources)) {
        const existingResources = await client.query('SELECT id, email FROM resources');
        existingResources.rows.forEach((r: { email: string; id: string; }) => resourceEmailMap.set(r.email, r.id));
        
        // Pre-load skills map
        const existingSkills = await client.query('SELECT id, name FROM skills');
        existingSkills.rows.forEach((s: { name: string; id: string; }) => skillNameMap.set(normalize(s.name), s.id));

        for (const res of importedResources) {
            const { Nome: name, Email: email, Ruolo: roleName, Horizontal: horizontal, Sede: location, 'Data Assunzione': hireDate, 'Anzianità (anni)': workSeniority, Note: notes, Competenze: skillsString } = res;
            if (!name || !email) {
                warnings.push(`Risorsa '${name || 'Sconosciuta'}' saltata: dati obbligatori mancanti.`);
                continue;
            }

            const roleId = roleName ? roleNameMap.get(roleName) : null;
            if (roleName && !roleId) warnings.push(`Ruolo '${roleName}' non trovato per risorsa '${name}'.`);

            let resourceId = resourceEmailMap.get(email);
            
            if (!resourceId) {
                resourceId = uuidv4();
                await client.query(
                    'INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                    [resourceId, name, email, roleId, horizontal, location, formatDateForDB(parseDate(hireDate)), workSeniority, notes]
                );
                resourceEmailMap.set(email, resourceId);
            } else {
                 await client.query(
                    'UPDATE resources SET name=$1, role_id=$2, horizontal=$3, location=$4, hire_date=$5, work_seniority=$6, notes=$7 WHERE id=$8',
                    [name, roleId, horizontal, location, formatDateForDB(parseDate(hireDate)), workSeniority, notes, resourceId]
                );
            }

            // Handle Skills Import from Resources Sheet
            if (skillsString && typeof skillsString === 'string') {
                const skillsList = skillsString.split(',').map((s: string) => s.trim()).filter(Boolean);
                for (const skillName of skillsList) {
                    const normalizedName = normalize(skillName);
                    let skillId = skillNameMap.get(normalizedName);

                    if (!skillId) {
                        // Create new skill if not exists
                        skillId = uuidv4();
                        await client.query('INSERT INTO skills (id, name) VALUES ($1, $2)', [skillId, skillName.trim()]); // Use original casing for insert
                        skillNameMap.set(normalizedName, skillId);
                    }

                    // Assign skill to resource if not already assigned
                    await client.query(
                        'INSERT INTO resource_skills (resource_id, skill_id) VALUES ($1, $2) ON CONFLICT (resource_id, skill_id) DO NOTHING',
                        [resourceId, skillId]
                    );
                }
            }
        }
    }
    
    // 6. Import Projects
    if (Array.isArray(importedProjects)) {
        for (const proj of importedProjects) {
            const { 'Nome Progetto': name, Cliente: clientName, Stato: status, 'Budget (€)': budget, 'Realizzazione (%)': realizationPercentage, 'Data Inizio': startDate, 'Data Fine': endDate, 'Project Manager': projectManager, Note: notes } = proj;
            
            if (!name) continue;
            
            const clientId = clientName ? clientNameMap.get(clientName) : null;
            if (clientName && !clientId) warnings.push(`Cliente '${clientName}' non trovato per progetto '${name}'.`);

            const existing = await client.query('SELECT id FROM projects WHERE name = $1 AND client_id IS NOT DISTINCT FROM $2', [name, clientId]);
            
            if (existing.rows.length === 0) {
                const newId = uuidv4();
                await client.query(
                    'INSERT INTO projects (id, name, client_id, status, budget, realization_percentage, start_date, end_date, project_manager, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                    [newId, name, clientId, status, budget, realizationPercentage, formatDateForDB(parseDate(startDate)), formatDateForDB(parseDate(endDate)), projectManager, notes]
                );
            }
        }
    }
};

const importStaffing = async (client: any, body: any, warnings: string[]) => {
    const { staffing } = body;
    if (!Array.isArray(staffing)) return;

    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    const projectMap = new Map((await client.query('SELECT id, name FROM projects')).rows.map((p: any) => [normalize(p.name), p.id]));
    const assignmentMap = new Map((await client.query('SELECT id, resource_id, project_id FROM assignments')).rows.map((a: any) => [`${a.resource_id}-${a.project_id}`, a.id]));

    for (const row of staffing) {
        const resourceName = row['Resource Name'];
        const projectName = row['Project Name'];

        if (!resourceName || !projectName) {
            warnings.push(`Riga di staffing saltata: mancano nome risorsa o progetto.`);
            continue;
        }

        const resourceId = resourceMap.get(normalize(resourceName));
        const projectId = projectMap.get(normalize(projectName));

        if (!resourceId) { warnings.push(`Staffing per '${resourceName}' saltato: risorsa non trovata.`); continue; }
        if (!projectId) { warnings.push(`Staffing per '${projectName}' saltato: progetto non trovato.`); continue; }

        let assignmentId = assignmentMap.get(`${resourceId}-${projectId}`);
        if (!assignmentId) {
            const newId = uuidv4();
            await client.query('INSERT INTO assignments (id, resource_id, project_id) VALUES ($1, $2, $3)', [newId, resourceId, projectId]);
            assignmentId = newId;
            assignmentMap.set(`${resourceId}-${projectId}`, newId);
            warnings.push(`Nuova assegnazione creata per ${resourceName} su ${projectName}.`);
        }

        for (const key in row) {
            if (key !== 'Resource Name' && key !== 'Project Name') {
                const date = parseDate(key);
                const percentage = Number(row[key]);
                if (date && !isNaN(percentage)) {
                    const dateStr = formatDateForDB(date);
                    if (percentage > 0) {
                        await client.query(
                            `INSERT INTO allocations (assignment_id, allocation_date, percentage) VALUES ($1, $2, $3)
                             ON CONFLICT (assignment_id, allocation_date) DO UPDATE SET percentage = EXCLUDED.percentage`,
                            [assignmentId, dateStr, percentage]
                        );
                    } else {
                        await client.query('DELETE FROM allocations WHERE assignment_id = $1 AND allocation_date = $2', [assignmentId, dateStr]);
                    }
                }
            }
        }
    }
};

const importResourceRequests = async (client: any, body: any, warnings: string[]) => {
    const { resource_requests: importedRequests } = body;
    if (!Array.isArray(importedRequests)) return;

    const projectMap = new Map((await client.query('SELECT id, name FROM projects')).rows.map((p: any) => [normalize(p.name), p.id]));
    const roleMap = new Map((await client.query('SELECT id, name FROM roles')).rows.map((r: any) => [normalize(r.name), r.id]));
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    
    for (const req of importedRequests) {
        const { projectName, roleName, requestorName, startDate, endDate, commitmentPercentage, isUrgent, isTechRequest, notes, status } = req;
        
        if (!projectName || !roleName || !startDate || !endDate || commitmentPercentage == null || !status) {
            warnings.push(`Richiesta saltata: mancano dati obbligatori (progetto, ruolo, date, impegno, stato).`);
            continue;
        }

        const projectId = projectMap.get(normalize(projectName));
        if (!projectId) {
            warnings.push(`Richiesta per progetto '${projectName}' saltata: progetto non trovato.`);
            continue;
        }

        const roleId = roleMap.get(normalize(roleName));
        if (!roleId) {
            warnings.push(`Richiesta per ruolo '${roleName}' saltata: ruolo non trovato.`);
            continue;
        }
        
        let requestorId = null;
        if (requestorName) {
            requestorId = resourceMap.get(normalize(requestorName));
            if (!requestorId) {
                warnings.push(`Richiedente '${requestorName}' non trovato per una richiesta, verrà lasciato vuoto.`);
            }
        }
        
        const parsedStartDate = parseDate(startDate);
        const parsedEndDate = parseDate(endDate);

        if (!parsedStartDate || !parsedEndDate) {
            warnings.push(`Richiesta per '${projectName}' saltata: formato data non valido.`);
            continue;
        }
        
        const diffTime = Math.abs(parsedEndDate.getTime() - parsedStartDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isLongTerm = diffDays > 60;
        
        const newId = uuidv4();
        await client.query(
            `INSERT INTO resource_requests (id, project_id, role_id, requestor_id, start_date, end_date, commitment_percentage, is_urgent, is_long_term, is_tech_request, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                newId, projectId, roleId, requestorId, formatDateForDB(parsedStartDate), formatDateForDB(parsedEndDate),
                Number(commitmentPercentage), String(isUrgent).toLowerCase() === 'si' || isUrgent === true, isLongTerm,
                String(isTechRequest).toLowerCase() === 'si' || isTechRequest === true, notes, status
            ]
        );
    }
};

const importInterviews = async (client: any, body: any, warnings: string[]) => {
    const { interviews: importedInterviews } = body;
    if (!Array.isArray(importedInterviews)) return;
    
    const roleMap = new Map((await client.query('SELECT id, name FROM roles')).rows.map((r: any) => [normalize(r.name), r.id]));
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    const horizontalSet = new Set((await client.query('SELECT value FROM horizontals')).rows.map((h: any) => normalize(h.value)));

    for (const interview of importedInterviews) {
        const { candidateName, candidateSurname, birthDate, horizontal, roleName, cv_summary, interviewersNames, interviewDate, feedback, notes, hiringStatus, entryDate, status } = interview;

        if (!candidateName || !candidateSurname || !status) {
            warnings.push(`Colloquio per '${candidateName || ''} ${candidateSurname || ''}' saltato: mancano nome, cognome o stato processo.`);
            continue;
        }
        
        let roleId = null;
        if (roleName) {
            roleId = roleMap.get(normalize(roleName));
            if (!roleId) {
                warnings.push(`Ruolo '${roleName}' non trovato per ${candidateName}, sarà lasciato vuoto.`);
            }
        }
        
        let validHorizontal = null;
        if (horizontal) {
            if (horizontalSet.has(normalize(horizontal))) {
                validHorizontal = String(horizontal); // Keep original casing if possible, or fetch from set if map
            } else {
                warnings.push(`Horizontal '${horizontal}' non trovato per ${candidateName}, sarà lasciato vuoto.`);
            }
        }

        let interviewersIds: string[] = [];
        if (interviewersNames && typeof interviewersNames === 'string') {
            const names = interviewersNames.split(',').map(name => name.trim());
            for (const name of names) {
                const id = resourceMap.get(normalize(name));
                if (id) {
                    interviewersIds.push(String(id));
                } else {
                    warnings.push(`Intervistatore '${name}' non trovato per colloquio di ${candidateName}.`);
                }
            }
        }

        const newId = uuidv4();
        await client.query(
            `INSERT INTO interviews (id, candidate_name, candidate_surname, birth_date, horizontal, role_id, cv_summary, interviewers_ids, interview_date, feedback, notes, hiring_status, entry_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
                newId, candidateName, candidateSurname, formatDateForDB(parseDate(birthDate)), validHorizontal, roleId,
                cv_summary || null,
                interviewersIds.length > 0 ? interviewersIds : null,
                formatDateForDB(parseDate(interviewDate)), feedback, notes, hiringStatus, formatDateForDB(parseDate(entryDate)), status
            ]
        );
    }
};

const importSkills = async (client: any, body: any, warnings: string[]) => {
    const { skills: importedSkills, associations: importedAssociations } = body;
    const skillNameMap = new Map<string, string>();
    
    // 1. Import Skills Definition
    if (Array.isArray(importedSkills)) {
        // Pre-load existing
        const existingSkills = await client.query('SELECT id, name FROM skills');
        existingSkills.rows.forEach((s: any) => skillNameMap.set(normalize(s.name), s.id));

        for (const s of importedSkills) {
            const { 'Nome Competenza': name, Categoria: category } = s;
            if (!name) continue;
            const normalized = normalize(name);
            
            if (!skillNameMap.has(normalized)) {
                const newId = uuidv4();
                await client.query('INSERT INTO skills (id, name, category) VALUES ($1, $2, $3)', [newId, String(name).trim(), category]);
                skillNameMap.set(normalized, newId);
            } else {
                 // Update category if exists
                 const id = skillNameMap.get(normalized);
                 await client.query('UPDATE skills SET category = $1 WHERE id = $2', [category, id]);
            }
        }
    }

    // 2. Import Associations
    if (Array.isArray(importedAssociations)) {
        const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
        
        // Reload skills map if skills were added above to ensure we have latest IDs
        const allSkills = await client.query('SELECT id, name FROM skills');
        allSkills.rows.forEach((s: any) => skillNameMap.set(normalize(s.name), s.id));

        for (const assoc of importedAssociations) {
             const { 'Nome Risorsa': resName, 'Nome Competenza': skillName, 'Livello': level, 'Data Conseguimento': acqDate, 'Data Scadenza': expDate } = assoc;
             
             if (!resName || !skillName) continue;
             
             const resourceId = resourceMap.get(normalize(resName));
             const skillId = skillNameMap.get(normalize(skillName));
             
             if (!resourceId) {
                 warnings.push(`Associazione saltata: Risorsa '${resName}' non trovata.`);
                 continue;
             }
             if (!skillId) {
                 warnings.push(`Associazione saltata: Competenza '${skillName}' non trovata (assicurati che sia definita nel foglio Competenze).`);
                 continue;
             }

             // Normalize level: Default to 1, ensure it's 1-5
             let normalizedLevel = 1;
             if (level) {
                 const parsed = parseInt(String(level), 10);
                 if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                     normalizedLevel = parsed;
                 }
             }
             
             await client.query(`
                INSERT INTO resource_skills (resource_id, skill_id, level, acquisition_date, expiration_date)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (resource_id, skill_id) DO UPDATE 
                SET level = EXCLUDED.level, acquisition_date = EXCLUDED.acquisition_date, expiration_date = EXCLUDED.expiration_date;
             `, [resourceId, skillId, normalizedLevel, formatDateForDB(parseDate(acqDate)), formatDateForDB(parseDate(expDate))]);
        }
    }
};

const importLeaves = async (client: any, body: any, warnings: string[]) => {
    const { leaves: importedLeaves } = body;
    if (!Array.isArray(importedLeaves)) return;

    // FIX: Added explicit type assertion [string, string] to fix TS2345 error
    const resourceRows = (await client.query('SELECT id, name FROM resources')).rows;
    const resourceEntries: [string, string][] = resourceRows.map((r: any) => [normalize(r.name), String(r.id)]);
    const resourceMap = new Map(resourceEntries);

    // FIX: Added explicit type assertion [string, string] to fix TS2345 error
    const leaveTypeRows = (await client.query('SELECT id, name FROM leave_types')).rows;
    const leaveTypeEntries: [string, string][] = leaveTypeRows.map((t: any) => [normalize(t.name), String(t.id)]);
    const leaveTypeMap = new Map(leaveTypeEntries);

    for (const leave of importedLeaves) {
        const { 'Nome Risorsa': resName, 'Tipologia Assenza': typeName, 'Data Inizio': startDate, 'Data Fine': endDate, 'Approvatori': approverNames, 'Stato': status, 'Note': notes } = leave;

        if (!resName || !typeName || !startDate || !endDate) {
            warnings.push(`Assenza saltata: mancano dati obbligatori (Risorsa, Tipo o Date).`);
            continue;
        }

        const resourceId = resourceMap.get(normalize(resName));
        if (!resourceId) {
            warnings.push(`Assenza saltata: Risorsa '${resName}' non trovata.`);
            continue;
        }

        const typeId = leaveTypeMap.get(normalize(typeName));
        if (!typeId) {
            warnings.push(`Assenza saltata: Tipologia '${typeName}' non trovata.`);
            continue;
        }

        const parsedStart = parseDate(startDate);
        const parsedEnd = parseDate(endDate);

        if (!parsedStart || !parsedEnd) {
            warnings.push(`Assenza per '${resName}' saltata: date non valide.`);
            continue;
        }

        // Normalize Status
        let normalizedStatus = 'PENDING';
        if (status) {
            const s = String(status).toUpperCase();
            if (['PENDING', 'APPROVED', 'REJECTED'].includes(s)) {
                normalizedStatus = s;
            }
        }

        // Process Approvers
        let approverIds: string[] | null = null;
        if (approverNames && typeof approverNames === 'string') {
            const names = approverNames.split(',').map(n => n.trim());
            approverIds = [];
            for (const name of names) {
                if (!name) continue;
                const id = resourceMap.get(normalize(name));
                if (id) {
                    approverIds.push(id);
                } else {
                    warnings.push(`Assenza per '${resName}': Approvatore '${name}' non trovato.`);
                }
            }
            if (approverIds.length === 0) approverIds = null;
        }

        const newId = uuidv4();
        await client.query(`
            INSERT INTO leave_requests (id, resource_id, type_id, start_date, end_date, status, notes, approver_ids)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            newId, 
            resourceId, 
            typeId, 
            formatDateForDB(parsedStart), 
            formatDateForDB(parsedEnd), 
            normalizedStatus, 
            notes, 
            approverIds // Passing string array works with pg driver for UUID[]
        ]);
    }
};

const importUsersPermissions = async (client: any, body: any, warnings: string[]) => {
    const { users, permissions } = body;
    
    // 1. Import Users
    if (Array.isArray(users)) {
        // FIX: Explicitly map query results to [string, string] tuples to fix TS2345 error
        const existingUsers = await client.query('SELECT id, username FROM app_users');
        const userEntries: [string, string][] = existingUsers.rows.map((u: any) => [String(u.username), String(u.id)]);
        const userMap = new Map(userEntries);
        
        // FIX: Explicitly map query results to [string, string] tuples to fix TS2345 error
        const resources = await client.query('SELECT id, email FROM resources');
        const resourceEntries: [string, string][] = resources.rows.map((r: any) => [normalize(r.email), String(r.id)]);
        const resourceMap = new Map(resourceEntries);

        // Generate default password hash for new users: "Staffing2024!"
        const defaultHash = await bcrypt.hash("Staffing2024!", 10);

        for (const u of users) {
            const { Username, Ruolo, 'Email Risorsa': resourceEmail, 'Stato Attivo': isActive } = u;
            
            if (!Username || !Ruolo) {
                warnings.push(`Utente saltato: username o ruolo mancante.`);
                continue;
            }

            const role = ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR', 'SIMPLE'].includes(Ruolo) ? Ruolo : 'SIMPLE';
            const active = String(isActive).toUpperCase() === 'SI';
            const resourceId = resourceEmail ? resourceMap.get(normalize(resourceEmail)) : null;

            if (resourceEmail && !resourceId) {
                warnings.push(`Avviso: Risorsa con email '${resourceEmail}' non trovata per l'utente '${Username}'.`);
            }

            if (userMap.has(String(Username))) {
                // Update existing user (DO NOT update password or flag)
                const id = userMap.get(String(Username));
                await client.query(`
                    UPDATE app_users 
                    SET role = $1, is_active = $2, resource_id = $3 
                    WHERE id = $4
                `, [role, active, resourceId, id]);
            } else {
                // Create new user with default password AND set must_change_password = TRUE
                const newId = uuidv4();
                await client.query(`
                    INSERT INTO app_users (id, username, password_hash, role, is_active, resource_id, must_change_password) 
                    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                `, [newId, Username, defaultHash, role, active, resourceId]);
                warnings.push(`Nuovo utente '${Username}' creato con password di default: Staffing2024!`);
            }
        }
    }

    // 2. Import Permissions
    if (Array.isArray(permissions)) {
        for (const p of permissions) {
            const { Ruolo, Pagina, 'Accesso Consentito': allowed } = p;
            
            if (!Ruolo || !Pagina) continue;
            
            const isAllowed = String(allowed).toUpperCase() === 'SI';
            
            await client.query(`
                INSERT INTO role_permissions (role, page_path, is_allowed)
                VALUES ($1, $2, $3)
                ON CONFLICT (role, page_path) 
                DO UPDATE SET is_allowed = EXCLUDED.is_allowed
            `, [Ruolo, Pagina, isAllowed]);
        }
    }
};


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

        console.log(`Starting import of type: ${type}`);

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