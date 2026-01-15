
/**
 * @file api/import.ts
 * @description Endpoint API per l'importazione massiva di dati da un file Excel con logica Batch/Bulk ottimizzata.
 * Rafforzato con controlli RBAC e parsing date UTC.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// --- SECURITY HELPER ---
const verifyOperational = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        const operationalRoles = ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];
        return operationalRoles.includes(decoded.role);
    } catch (e) {
        return false;
    }
};

// --- UTILITIES ---

/**
 * Helper per eseguire insert massivi (Bulk Insert).
 */
async function executeBulkInsert(
    client: any, 
    tableName: string, 
    columns: string[], 
    rows: any[][], 
    conflictClause: string = 'ON CONFLICT DO NOTHING'
) {
    if (rows.length === 0) return;

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

/**
 * Parsing robusto delle date forzato in UTC per evitare shift dovuti al timezone del server o dell'utente.
 */
const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) { 
        if(isNaN(dateValue.getTime())) return null;
        // Normalizza a mezzogiorno UTC per evitare problemi di boundary
        return new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), 12, 0, 0));
    }
    if (typeof dateValue === 'number') {
       const utc_days  = Math.floor(dateValue - 25569);
       const utc_value = utc_days * 86400;                                        
       const date_info = new Date(utc_value * 1000);
       return new Date(Date.UTC(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate(), 12, 0, 0));
    }
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
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
    
    const roleNameMap = new Map<string, string>();
    const clientNameMap = new Map<string, string>();
    const resourceEmailMap = new Map<string, string>();
    const resourceNameMap = new Map<string, string>();
    const skillNameMap = new Map<string, string>();
    
    const importConfig = async (tableName: string, items: { Valore: string }[]) => {
        if (!Array.isArray(items) || items.length === 0) return;
        const rowsToInsert = items.filter(item => item.Valore).map(item => [uuidv4(), item.Valore]);
        await executeBulkInsert(client, tableName, ['id', 'value'], rowsToInsert, 'ON CONFLICT (value) DO NOTHING');
    };

    await importConfig('horizontals', importedHorizontals);
    await importConfig('seniority_levels', importedSeniority);
    await importConfig('project_statuses', importedStatuses);
    await importConfig('client_sectors', importedSectors);
    await importConfig('locations', importedLocations);

    if (Array.isArray(importedCalendar) && importedCalendar.length > 0) {
        const calendarRows = importedCalendar
            .map(event => {
                const { 'Nome Evento': name, Data: date, Tipo: type, 'Sede (se locale)': location } = event;
                const dateObj = parseDate(date);
                if (!name || !dateObj || !type) return null;
                return [uuidv4(), name, formatDateForDB(dateObj), type, location === 'Tutte' ? null : location];
            })
            .filter(row => row !== null) as any[][];
        await executeBulkInsert(client, 'company_calendar', ['id', 'name', 'date', 'type', 'location'], calendarRows, 'ON CONFLICT (date, location) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type');
    }

    if (Array.isArray(importedRoles)) {
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

    if (Array.isArray(importedResources)) {
        const existingRes = await client.query('SELECT id, email, name FROM resources');
        existingRes.rows.forEach((r: any) => {
            resourceEmailMap.set(r.email, r.id);
            resourceNameMap.set(normalize(r.name), r.id);
        });
        
        const existingSkills = await client.query('SELECT id, name FROM skills');
        existingSkills.rows.forEach((s: any) => skillNameMap.set(normalize(s.name), s.id));

        const resourceRows: any[][] = [];
        const newSkillsToInsert = new Map<string, string>();
        const resourceSkillRows: any[][] = [];

        for (const res of importedResources) {
            const { Nome: name, Email: email, Ruolo: roleName, Horizontal: horizontal, Sede: location, 'Data Assunzione': hireDate, 'Anzianità (anni)': workSeniority, Note: notes, Competenze: skillsString, Tutor: tutorName } = res;
            if (!name || !email) {
                warnings.push(`Risorsa '${name}' saltata: dati mancanti.`);
                continue;
            }

            const roleId = roleName ? roleNameMap.get(roleName) : null;
            let resourceId = resourceEmailMap.get(email);
            if (!resourceId) {
                resourceId = uuidv4();
                resourceEmailMap.set(email, resourceId);
                resourceNameMap.set(normalize(name), resourceId);
            }
            
            let tutorId = tutorName ? resourceNameMap.get(normalize(tutorName)) : null;
            
            resourceRows.push([
                resourceId, name, email, roleId, horizontal, location, 
                formatDateForDB(parseDate(hireDate)), workSeniority, notes, tutorId
            ]);

            if (skillsString && typeof skillsString === 'string') {
                const skillsList = skillsString.split(',').map((s: string) => s.trim()).filter(Boolean);
                for (const skillName of skillsList) {
                    const normName = normalize(skillName);
                    let skillId = skillNameMap.get(normName) || newSkillsToInsert.get(normName);
                    if (!skillId) {
                        skillId = uuidv4();
                        newSkillsToInsert.set(normName, skillId);
                    }
                    if (skillId && resourceId) {
                        resourceSkillRows.push([resourceId, skillId]);
                    }
                }
            }
        }

        await executeBulkInsert(client, 'resources', ['id', 'name', 'email', 'role_id', 'horizontal', 'location', 'hire_date', 'work_seniority', 'notes', 'tutor_id'], resourceRows, `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role_id = EXCLUDED.role_id, horizontal = EXCLUDED.horizontal, location = EXCLUDED.location, hire_date = EXCLUDED.hire_date, work_seniority = EXCLUDED.work_seniority, notes = EXCLUDED.notes, tutor_id = EXCLUDED.tutor_id`);
        if (newSkillsToInsert.size > 0) {
            const skillRows = Array.from(newSkillsToInsert.entries()).map(([norm, id]) => [id, norm.charAt(0).toUpperCase() + norm.slice(1)]);
            await executeBulkInsert(client, 'skills', ['id', 'name'], skillRows, 'ON CONFLICT (id) DO NOTHING');
        }
        await executeBulkInsert(client, 'resource_skills', ['resource_id', 'skill_id'], resourceSkillRows, 'ON CONFLICT (resource_id, skill_id) DO NOTHING');
    }

    if (Array.isArray(importedProjects)) {
        const projectRows: any[][] = [];
        for (const proj of importedProjects) {
            const { 'Nome Progetto': name, Cliente: clientName, Stato: status, 'Budget (€)': budget, 'Realizzazione (%)': realizationPercentage, 'Data Inizio': startDate, 'Data Fine': endDate, 'Project Manager': projectManager, Note: notes } = proj;
            if (!name) continue;
            const clientId = clientName ? clientNameMap.get(clientName) : null;
            projectRows.push([uuidv4(), name, clientId, status, budget, realizationPercentage, formatDateForDB(parseDate(startDate)), formatDateForDB(parseDate(endDate)), projectManager, notes]);
        }
        await executeBulkInsert(client, 'projects', ['id', 'name', 'client_id', 'status', 'budget', 'realization_percentage', 'start_date', 'end_date', 'project_manager', 'notes'], projectRows, 'ON CONFLICT (name, client_id) DO UPDATE SET status = EXCLUDED.status, budget = EXCLUDED.budget, end_date = EXCLUDED.end_date, realization_percentage = EXCLUDED.realization_percentage');
    }
};

const importStaffing = async (client: any, body: any, warnings: string[]) => {
    const { staffing } = body;
    if (!Array.isArray(staffing) || staffing.length === 0) return;
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    const projectMap = new Map((await client.query('SELECT id, name FROM projects')).rows.map((p: any) => [normalize(p.name), p.id]));
    const assignmentMap = new Map<string, string>();
    (await client.query('SELECT id, resource_id, project_id FROM assignments')).rows.forEach((a: any) => assignmentMap.set(`${a.resource_id}-${a.project_id}`, a.id));
    const newAssignments: any[][] = [];
    const allocationsToUpsert: any[][] = [];
    for (const row of staffing) {
        const resourceName = row['Resource Name'];
        const projectName = row['Project Name'];
        if (!resourceName || !projectName) continue;
        const resourceId = resourceMap.get(normalize(resourceName));
        const projectId = projectMap.get(normalize(projectName));
        if (!resourceId || !projectId) { warnings.push(`Staffing saltato: '${resourceName}' o '${projectName}' non trovati.`); continue; }
        const key = `${resourceId}-${projectId}`;
        let assignmentId = assignmentMap.get(key);
        if (!assignmentId) {
            assignmentId = uuidv4();
            newAssignments.push([assignmentId, resourceId, projectId]);
            assignmentMap.set(key, assignmentId);
        }
        for (const colKey in row) {
            if (colKey !== 'Resource Name' && colKey !== 'Project Name') {
                const date = parseDate(colKey);
                const percentage = Number(row[colKey]);
                if (date && !isNaN(percentage) && percentage > 0) {
                    allocationsToUpsert.push([assignmentId, formatDateForDB(date), percentage]);
                }
            }
        }
    }
    if (newAssignments.length > 0) await executeBulkInsert(client, 'assignments', ['id', 'resource_id', 'project_id'], newAssignments);
    if (allocationsToUpsert.length > 0) await executeBulkInsert(client, 'allocations', ['assignment_id', 'allocation_date', 'percentage'], allocationsToUpsert, 'ON CONFLICT (assignment_id, allocation_date) DO UPDATE SET percentage = EXCLUDED.percentage');
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
        const isOsrOpen = String(req['OSR Aperta']).toUpperCase() === 'SI' || req['OSR Aperta'] === true;
        const osrNumber = req['Numero OSR'] || null;
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (!projectName || !roleName || !start || !end) continue;
        const projectId = projectMap.get(normalize(projectName));
        const roleId = roleMap.get(normalize(roleName));
        const requestorId = requestorName ? resourceMap.get(normalize(requestorName)) : null;
        if (!projectId || !roleId) { warnings.push(`Richiesta saltata per ${projectName}: dati mancanti.`); continue; }
        const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        rowsToInsert.push([uuidv4(), projectId, roleId, requestorId, formatDateForDB(start), formatDateForDB(end), Number(commitmentPercentage), !!isUrgent, diffDays > 60, !!isTechRequest, isOsrOpen, isOsrOpen ? osrNumber : null, notes, status]);
    }
    await executeBulkInsert(client, 'resource_requests', ['id', 'project_id', 'role_id', 'requestor_id', 'start_date', 'end_date', 'commitment_percentage', 'is_urgent', 'is_long_term', 'is_tech_request', 'is_osr_open', 'osr_number', 'notes', 'status'], rowsToInsert);
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
            interviewersIds = interviewersNames.split(',').map(n => resourceMap.get(normalize(n.trim()))).filter(id => id) as string[];
        }
        rowsToInsert.push([uuidv4(), candidateName, candidateSurname, formatDateForDB(parseDate(birthDate)), horizontal, roleId, cv_summary || null, interviewersIds.length > 0 ? interviewersIds : null, formatDateForDB(parseDate(interviewDate)), feedback, notes, hiringStatus, formatDateForDB(parseDate(entryDate)), status]);
    }
    await executeBulkInsert(client, 'interviews', ['id', 'candidate_name', 'candidate_surname', 'birth_date', 'horizontal', 'role_id', 'cv_summary', 'interviewers_ids', 'interview_date', 'feedback', 'notes', 'hiring_status', 'entry_date', 'status'], rowsToInsert);
};

const importSkills = async (client: any, body: any, warnings: string[]) => {
    const { skills: importedSkills, associations: importedAssociations } = body;
    const macroMap = new Map<string, string>();
    const catMap = new Map<string, string>();
    const skillMap = new Map<string, string>();
    (await client.query('SELECT id, name FROM skill_macro_categories')).rows.forEach((r: any) => macroMap.set(normalize(r.name), r.id));
    (await client.query('SELECT id, name FROM skill_categories')).rows.forEach((r: any) => catMap.set(normalize(r.name), r.id));
    (await client.query('SELECT id, name FROM skills')).rows.forEach((r: any) => skillMap.set(normalize(r.name), r.id));
    const macrosToInsert = new Map<string, string>();
    const catsToInsert = new Map<string, string>();
    const skillsToInsert = new Map<string, string>();
    const catMacroLinks = new Map<string, string>();
    const skillCatLinks = new Map<string, string>();
    const skillsMetadata = new Map<string, boolean>();
    const getOrGenerateId = (name: string, map: Map<string, string>, insertMap: Map<string, string>): string => {
        const norm = normalize(name);
        if (map.has(norm)) return map.get(norm)!;
        if (insertMap.has(norm)) return insertMap.get(norm)!;
        const newId = uuidv4();
        insertMap.set(norm, newId);
        return newId;
    };
    const processSkillRow = (skillName: string, catString: string, macroString: string, isCert: boolean) => {
        if (!skillName) return;
        const macroIds: string[] = [];
        if (macroString) macroString.split(',').map(s => s.trim()).forEach(mName => { if(mName) macroIds.push(getOrGenerateId(mName, macroMap, macrosToInsert)); });
        const catIds: string[] = [];
        if (catString) catString.split(',').map(s => s.trim()).forEach(cName => { if(cName) catIds.push(getOrGenerateId(cName, catMap, catsToInsert)); });
        if (macroIds.length > 0 && catIds.length > 0) catIds.forEach(cId => macroIds.forEach(mId => catMacroLinks.set(`${cId}|${mId}`, '1')));
        const skillId = getOrGenerateId(skillName, skillMap, skillsToInsert);
        skillsMetadata.set(skillId, isCert);
        if (catIds.length > 0) catIds.forEach(cId => skillCatLinks.set(`${skillId}|${cId}`, '1'));
    };
    if (Array.isArray(importedSkills)) {
        for (const row of importedSkills) processSkillRow(row['Nome Competenza'], row['Ambito (Categorie)'] || row['Ambito'], row['Macro Ambito'], String(row['Certificazione']).toUpperCase() === 'SI');
    }
    const associationsToInsert = new Map<string, any[]>();
    if (Array.isArray(importedAssociations)) {
        const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
        for (const row of importedAssociations) {
            const { 'Nome Risorsa': resName, 'Nome Competenza': skillName, 'Livello': level, 'Data Conseguimento': acqDate, 'Data Scadenza': expDate } = row;
            if (!resName || !skillName) continue;
            const resourceId = resourceMap.get(normalize(resName));
            if (!resourceId) { warnings.push(`Risorsa non trovata: ${resName}`); continue; }
            processSkillRow(skillName, row['Ambito (Categorie)'] || row['Ambito'], row['Macro Ambito'], false);
            const skillId = getOrGenerateId(skillName, skillMap, skillsToInsert);
            let normalizedLevel = parseInt(String(level), 10);
            if (isNaN(normalizedLevel) || normalizedLevel < 1 || normalizedLevel > 5) normalizedLevel = 1;
            associationsToInsert.set(`${resourceId}|${skillId}`, [resourceId, skillId, normalizedLevel, formatDateForDB(parseDate(acqDate)), formatDateForDB(parseDate(expDate))]);
        }
    }
    if (macrosToInsert.size > 0) await executeBulkInsert(client, 'skill_macro_categories', ['id', 'name'], Array.from(macrosToInsert.entries()).map(([norm, id]) => [id, norm.charAt(0).toUpperCase() + norm.slice(1)]));
    if (catsToInsert.size > 0) await executeBulkInsert(client, 'skill_categories', ['id', 'name'], Array.from(catsToInsert.entries()).map(([norm, id]) => [id, norm.charAt(0).toUpperCase() + norm.slice(1)]));
    if (catMacroLinks.size > 0) await executeBulkInsert(client, 'skill_category_macro_map', ['category_id', 'macro_category_id'], Array.from(catMacroLinks.keys()).map(key => key.split('|')));
    if (skillsToInsert.size > 0) await executeBulkInsert(client, 'skills', ['id', 'name', 'is_certification'], Array.from(skillsToInsert.entries()).map(([norm, id]) => [id, norm.charAt(0).toUpperCase() + norm.slice(1), skillsMetadata.get(id) || false]), 'ON CONFLICT (id) DO UPDATE SET is_certification = EXCLUDED.is_certification');
    if (skillCatLinks.size > 0) await executeBulkInsert(client, 'skill_skill_category_map', ['skill_id', 'category_id'], Array.from(skillCatLinks.keys()).map(key => key.split('|')));
    if (associationsToInsert.size > 0) await executeBulkInsert(client, 'resource_skills', ['resource_id', 'skill_id', 'level', 'acquisition_date', 'expiration_date'], Array.from(associationsToInsert.values()), 'ON CONFLICT (resource_id, skill_id) DO UPDATE SET level = EXCLUDED.level, acquisition_date = EXCLUDED.acquisition_date, expiration_date = EXCLUDED.expiration_date');
};

const importLeaves = async (client: any, body: any, warnings: string[]) => {
    const { leaves: importedLeaves } = body;
    if (!Array.isArray(importedLeaves)) return;
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    const leaveTypeMap = new Map((await client.query('SELECT id, name FROM leave_types')).rows.map((t: any) => [normalize(t.name), t.id]));
    const rowsToInsert: any[][] = [];
    for (const leave of importedLeaves) {
        const { 'Nome Risorsa': resName, 'Tipologia Assenza': typeName, 'Data Inizio': startDate, 'Data Fine': endDate, 'Approvatori': approverNames, 'Stato': status, 'Note': notes } = leave;
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (!resName || !typeName || !start || !end) continue;
        const resourceId = resourceMap.get(normalize(resName));
        const typeId = leaveTypeMap.get(normalize(typeName));
        if (!resourceId || !typeId) { warnings.push(`Assenza saltata: risorsa o tipo non trovato.`); continue; }
        let normalizedStatus = ['PENDING', 'APPROVED', 'REJECTED'].includes(String(status).toUpperCase()) ? String(status).toUpperCase() : 'PENDING';
        let approverIds: string[] | null = null;
        if (approverNames && typeof approverNames === 'string') {
            approverIds = approverNames.split(',').map(n => resourceMap.get(normalize(n.trim()))).filter(id => id) as string[];
            if (approverIds.length === 0) approverIds = null;
        }
        rowsToInsert.push([uuidv4(), resourceId, typeId, formatDateForDB(start), formatDateForDB(end), normalizedStatus, notes, approverIds]);
    }
    await executeBulkInsert(client, 'leave_requests', ['id', 'resource_id', 'type_id', 'start_date', 'end_date', 'status', 'notes', 'approver_ids'], rowsToInsert);
};

const importUsersPermissions = async (client: any, body: any, warnings: string[]) => {
    const { users, permissions } = body;
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
                await client.query('UPDATE app_users SET role=$1, is_active=$2, resource_id=$3 WHERE username=$4', [role, active, resourceId, Username]);
            } else {
                usersToInsert.push([uuidv4(), Username, defaultHash, role, active, resourceId, true]);
            }
        }
        await executeBulkInsert(client, 'app_users', ['id', 'username', 'password_hash', 'role', 'is_active', 'resource_id', 'must_change_password'], usersToInsert);
    }
    if (Array.isArray(permissions)) {
        const permRows = permissions.map(p => {
            const { Ruolo, Pagina, 'Accesso Consentito': allowed } = p;
            if (!Ruolo || !Pagina) return null;
            return [Ruolo, Pagina, String(allowed).toUpperCase() === 'SI'];
        }).filter(r => r !== null) as any[][];
        await executeBulkInsert(client, 'role_permissions', ['role', 'page_path', 'is_allowed'], permRows, 'ON CONFLICT (role, page_path) DO UPDATE SET is_allowed = EXCLUDED.is_allowed');
    }
};

const importTutorMapping = async (client: any, body: any, warnings: string[]) => {
    const { mapping } = body;
    if (!Array.isArray(mapping) || mapping.length === 0) return;
    const emailMap = new Map((await client.query('SELECT id, email FROM resources')).rows.map((r: any) => [normalize(r.email), r.id]));
    const nameMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    for (const row of mapping) {
        const { 'Risorsa': rName, 'Email Risorsa': rEmail, 'Tutor': tName, 'Email Tutor': tEmail } = row;
        let resourceId = rEmail ? emailMap.get(normalize(rEmail)) : (rName ? nameMap.get(normalize(rName)) : null);
        if (!resourceId) { warnings.push(`Risorsa non trovata: ${rEmail || rName}`); continue; }
        let tutorId = tEmail ? emailMap.get(normalize(tEmail)) : (tName ? nameMap.get(normalize(tName)) : null);
        if ((tEmail || tName) && !tutorId) { warnings.push(`Tutor non trovato per ${rName}: ${tEmail || tName}`); continue; }
        if (resourceId === tutorId) { warnings.push(`Auto-referenza ignorata per: ${rName}`); tutorId = null; }
        await client.query(`UPDATE resources SET tutor_id = $1 WHERE id = $2`, [tutorId, resourceId]);
    }
};

// --- HANDLER ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!verifyOperational(req)) {
        return res.status(403).json({ error: 'Access denied: Operational role required for imports.' });
    }

    const { type } = req.query;
    const client = await db.connect();
    const warnings: string[] = [];

    try {
        await client.query('BEGIN');
        switch(type) {
            case 'core_entities': await importCoreEntities(client, req.body, warnings); break;
            case 'staffing': await importStaffing(client, req.body, warnings); break;
            case 'resource_requests': await importResourceRequests(client, req.body, warnings); break;
            case 'interviews': await importInterviews(client, req.body, warnings); break;
            case 'skills': await importSkills(client, req.body, warnings); break;
            case 'leaves': await importLeaves(client, req.body, warnings); break;
            case 'users_permissions': await importUsersPermissions(client, req.body, warnings); break;
            case 'tutor_mapping': await importTutorMapping(client, req.body, warnings); break;
            default: throw new Error('Tipo di importazione non valido.');
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Importazione completata con successo.', warnings });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
