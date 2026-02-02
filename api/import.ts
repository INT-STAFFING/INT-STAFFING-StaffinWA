
import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

const verifyOperational = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, String(JWT_SECRET || '')) as any;
        return ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'].includes(decoded.role);
    } catch (e) { return false; }
};

async function executeBulkInsert(client: any, tableName: string, columns: string[], rows: any[][], conflictClause: string = 'ON CONFLICT DO NOTHING') {
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
        await client.query(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders.join(',')} ${conflictClause}`, values);
    }
}

/**
 * Parsing robusto per date "Pure" (senza orario).
 * Restituisce una Date impostata a Mezzanotte UTC esatta.
 */
const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    // Se è già Date
    if (dateValue instanceof Date) { 
        if(isNaN(dateValue.getTime())) return null;
        // Ricostruiamo in UTC per sicurezza
        return new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
    }
    
    // Se è numero seriale Excel
    if (typeof dateValue === 'number') {
       const utc_days  = Math.floor(dateValue - 25569);
       const utc_value = utc_days * 86400;                                        
       const date_info = new Date(utc_value * 1000);
       return new Date(Date.UTC(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate()));
    }
    
    // Se è stringa
    if (typeof dateValue === 'string') {
        // Tenta ISO YYYY-MM-DD
        const parts = dateValue.split('T')[0].split('-');
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                return new Date(Date.UTC(y, m - 1, d));
            }
        }
        // Fallback al parser nativo, poi normalizza a UTC
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        }
    }
    return null;
}

const formatDateForDB = (date: Date | null): string | null => {
    if (!date || isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

const normalize = (str: any): string => String(str || '').trim().toLowerCase();

const importCoreEntities = async (client: any, body: any, warnings: string[]) => {
    const { clients, roles, resources, projects, calendar, horizontals, seniorityLevels, projectStatuses, clientSectors, locations } = body;

    // Config imports (Simple inserts, ignore duplicates)
    if (Array.isArray(horizontals)) await executeBulkInsert(client, 'horizontals', ['id', 'value'], horizontals.map(h => [uuidv4(), h.value || h.Valore]));
    if (Array.isArray(seniorityLevels)) await executeBulkInsert(client, 'seniority_levels', ['id', 'value'], seniorityLevels.map(s => [uuidv4(), s.value || s.Valore]));
    if (Array.isArray(projectStatuses)) await executeBulkInsert(client, 'project_statuses', ['id', 'value'], projectStatuses.map(s => [uuidv4(), s.value || s.Valore]));
    if (Array.isArray(clientSectors)) await executeBulkInsert(client, 'client_sectors', ['id', 'value'], clientSectors.map(s => [uuidv4(), s.value || s.Valore]));
    if (Array.isArray(locations)) await executeBulkInsert(client, 'locations', ['id', 'value'], locations.map(l => [uuidv4(), l.value || l.Valore]));

    // Clients
    if (Array.isArray(clients)) {
        const clientRows = clients.map(c => [uuidv4(), c['Nome Cliente'] || c.name, c['Settore'] || c.sector, c['Email Contatto'] || c.contactEmail]);
        await executeBulkInsert(client, 'clients', ['id', 'name', 'sector', 'contact_email'], clientRows);
    }

    // Roles (Updated with Chargeability Columns)
    if (Array.isArray(roles)) {
        const roleRows = roles.map(r => {
            const dailyCost = r['Costo Giornaliero (€)'] !== undefined ? Number(r['Costo Giornaliero (€)']) : (r.dailyCost !== undefined ? Number(r.dailyCost) : 0);
            const overheadPct = r['Overhead %'] !== undefined ? Number(r['Overhead %']) : (r.overheadPct !== undefined ? Number(r.overheadPct) : 0);
            
            // Calc daily expenses for DB (using percentage if present, otherwise direct value)
            let dailyExpenses = 0;
            if (r['Overhead %'] !== undefined || r.overheadPct !== undefined) {
                dailyExpenses = (dailyCost * overheadPct) / 100;
            } else {
                dailyExpenses = r['Spese Giornaliere Calcolate (€)'] !== undefined ? Number(r['Spese Giornaliere Calcolate (€)']) : (r.dailyExpenses !== undefined ? Number(r.dailyExpenses) : 0);
            }

            const chargeablePct = r['Chargeable %'] !== undefined ? Number(r['Chargeable %']) : (r.chargeablePct !== undefined ? Number(r.chargeablePct) : 100);
            const trainingPct = r['Training %'] !== undefined ? Number(r['Training %']) : (r.trainingPct !== undefined ? Number(r.trainingPct) : 0);
            const bdPct = r['BD %'] !== undefined ? Number(r['BD %']) : (r.bdPct !== undefined ? Number(r.bdPct) : 0);

            // Simple validation sum
            if (Math.abs((chargeablePct + trainingPct + bdPct) - 100) > 0.1) {
                warnings.push(`Ruolo '${r['Nome Ruolo'] || r.name}': le percentuali non sommano a 100. Impostati default.`);
            }

            return [
                uuidv4(),
                r['Nome Ruolo'] || r.name,
                r['Livello Seniority'] || r.seniorityLevel,
                dailyCost,
                r['Costo Standard (€)'] || r.standardCost,
                dailyExpenses,
                overheadPct,
                chargeablePct,
                trainingPct,
                bdPct
            ];
        });
        await executeBulkInsert(client, 'roles', ['id', 'name', 'seniority_level', 'daily_cost', 'standard_cost', 'daily_expenses', 'overhead_pct', 'chargeable_pct', 'training_pct', 'bd_pct'], roleRows, 'ON CONFLICT (name) DO UPDATE SET daily_cost = EXCLUDED.daily_cost, standard_cost = EXCLUDED.standard_cost, daily_expenses = EXCLUDED.daily_expenses, overhead_pct = EXCLUDED.overhead_pct, chargeable_pct = EXCLUDED.chargeable_pct, training_pct = EXCLUDED.training_pct, bd_pct = EXCLUDED.bd_pct');
    }

    // Resources
    // Re-fetch roles to map names to IDs
    const roleMap = new Map((await client.query('SELECT id, name FROM roles')).rows.map((r: any) => [normalize(r.name), r.id]));
    const resourceRows: any[][] = [];
    
    if (Array.isArray(resources)) {
        for (const r of resources) {
            const roleName = r['Ruolo'] || r.roleName;
            const roleId = roleMap.get(normalize(roleName));
            if (!roleId && roleName) warnings.push(`Ruolo '${roleName}' non trovato per la risorsa '${r['Nome'] || r.name}'.`);
            
            const hireDate = parseDate(r['Data Assunzione'] || r.hireDate);

            // Simple check for existing resource by email to avoid duplicates or update them
            const email = r['Email'] || r.email;
            const existingRes = await client.query('SELECT id FROM resources WHERE email = $1', [email]);
            
            if (existingRes.rows.length === 0) {
                 resourceRows.push([
                    uuidv4(),
                    r['Nome'] || r.name,
                    email,
                    roleId,
                    r['Horizontal'] || r.horizontal,
                    r['Sede'] || r.location,
                    formatDateForDB(hireDate),
                    r['Anzianità (anni)'] || r.workSeniority,
                    r['Note'] || r.notes
                ]);
            }
        }
        await executeBulkInsert(client, 'resources', ['id', 'name', 'email', 'role_id', 'horizontal', 'location', 'hire_date', 'work_seniority', 'notes'], resourceRows);
    }

    // Projects
    // Re-fetch clients to map names to IDs
    const clientMap = new Map((await client.query('SELECT id, name FROM clients')).rows.map((c: any) => [normalize(c.name), c.id]));
    const projectRows: any[][] = [];

    if (Array.isArray(projects)) {
        for (const p of projects) {
            const clientName = p['Cliente'] || p.clientName;
            const clientId = clientMap.get(normalize(clientName));
            
            const startDate = parseDate(p['Data Inizio'] || p.startDate);
            const endDate = parseDate(p['Data Fine'] || p.endDate);

            projectRows.push([
                uuidv4(),
                p['Nome Progetto'] || p.name,
                clientId,
                p['Stato'] || p.status,
                p['Budget (€)'] || p.budget,
                p['Realizzazione (%)'] || p.realizationPercentage,
                formatDateForDB(startDate),
                formatDateForDB(endDate),
                p['Project Manager'] || p.projectManager,
                p['Note'] || p.notes
            ]);
        }
        await executeBulkInsert(client, 'projects', ['id', 'name', 'client_id', 'status', 'budget', 'realization_percentage', 'start_date', 'end_date', 'project_manager', 'notes'], projectRows);
    }

    // Calendar
    if (Array.isArray(calendar)) {
        const calendarRows = calendar.map(e => [
            uuidv4(),
            e['Nome Evento'] || e.name,
            formatDateForDB(parseDate(e['Data'] || e.date)),
            e['Tipo'] || e.type,
            (e['Sede (se locale)'] === 'Tutte' || !e['Sede (se locale)']) ? null : (e['Sede (se locale)'] || e.location)
        ]);
        await executeBulkInsert(client, 'company_calendar', ['id', 'name', 'date', 'type', 'location'], calendarRows);
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
                const date = parseDate(colKey); // Uses robust UTC parser
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
    const { resource_requests } = body;
    if (!Array.isArray(resource_requests)) return;
    
    const projectMap = new Map((await client.query('SELECT id, name FROM projects')).rows.map((p: any) => [normalize(p.name), p.id]));
    const roleMap = new Map((await client.query('SELECT id, name FROM roles')).rows.map((r: any) => [normalize(r.name), r.id]));
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));

    const requestRows: any[][] = [];
    
    // Get last Request Code number for generation
    const codeRes = await client.query("SELECT request_code FROM resource_requests WHERE request_code LIKE 'HCR%' ORDER BY length(request_code) DESC, request_code DESC LIMIT 1");
    let lastNum = 0;
    if (codeRes.rows.length > 0) {
        const match = codeRes.rows[0].request_code.match(/HCR(\d+)/);
        if (match) lastNum = parseInt(match[1], 10);
    }

    for (const req of resource_requests) {
        const projectName = req['Progetto'] || req.projectName;
        const projectId = projectMap.get(normalize(projectName));
        const roleName = req['Ruolo Richiesto'] || req.roleName;
        const roleId = roleMap.get(normalize(roleName));
        
        if (!projectId || !roleId) { warnings.push(`Richiesta saltata: Progetto '${projectName}' o Ruolo '${roleName}' non trovati.`); continue; }
        
        const reqName = req['Richiedente'] || req.requestorName;
        const requestorId = reqName ? resourceMap.get(normalize(reqName)) : null;

        const startDate = parseDate(req['Data Inizio'] || req.startDate);
        const endDate = parseDate(req['Data Fine'] || req.endDate);

        lastNum++;
        const newCode = `HCR${String(lastNum).padStart(5, '0')}`;

        requestRows.push([
            uuidv4(),
            newCode,
            projectId,
            roleId,
            requestorId,
            formatDateForDB(startDate),
            formatDateForDB(endDate),
            req['Impegno %'] || req.commitmentPercentage || 100,
            (req['Urgent'] === 'SI' || req['Urgent'] === 'Sì' || req.isUrgent === true),
            (req['Tech'] === 'SI' || req['Tech'] === 'Sì' || req.isTechRequest === true),
            (req['OSR Aperta'] === 'SI' || req['OSR Aperta'] === 'Sì' || req.isOsrOpen === true),
            req['Numero OSR'] || req.osrNumber,
            req['Note'] || req.notes,
            req['Stato'] || req.status || 'ATTIVA'
        ]);
    }
    
    await executeBulkInsert(client, 'resource_requests', ['id', 'request_code', 'project_id', 'role_id', 'requestor_id', 'start_date', 'end_date', 'commitment_percentage', 'is_urgent', 'is_tech_request', 'is_osr_open', 'osr_number', 'notes', 'status'], requestRows);
};

const importInterviews = async (client: any, body: any, warnings: string[]) => {
    const { interviews } = body;
    if (!Array.isArray(interviews)) return;

    const roleMap = new Map((await client.query('SELECT id, name FROM roles')).rows.map((r: any) => [normalize(r.name), r.id]));
    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    
    const interviewRows: any[][] = [];

    for (const int of interviews) {
        const roleName = int['Ruolo Proposto'] || int.roleName;
        const roleId = roleMap.get(normalize(roleName));
        
        // Interviewers parsing (comma separated names)
        const interviewersString = int['Colloquiato Da'] || int.interviewersNames;
        const interviewerIds: string[] = [];
        if (interviewersString) {
            interviewersString.split(',').forEach((n: string) => {
                const id = resourceMap.get(normalize(n.trim()));
                if (id) interviewerIds.push(id);
            });
        }
        
        const birthDate = parseDate(int['Data di Nascita'] || int.birthDate);
        const interviewDate = parseDate(int['Data Colloquio'] || int.interviewDate);
        const entryDate = parseDate(int['Data Ingresso'] || int.entryDate);

        interviewRows.push([
            uuidv4(),
            int['Nome Candidato'] || int.candidateName,
            int['Cognome Candidato'] || int.candidateSurname,
            formatDateForDB(birthDate),
            int['Horizontal'] || int.horizontal,
            roleId,
            int['Riassunto CV'] || int.cvSummary,
            interviewerIds,
            formatDateForDB(interviewDate),
            int['Feedback'] || int.feedback,
            int['Note'] || int.notes,
            int['Stato Assunzione'] || int.hiringStatus,
            formatDateForDB(entryDate),
            int['Stato Processo'] || int.status || 'Aperto'
        ]);
    }

    await executeBulkInsert(client, 'interviews', ['id', 'candidate_name', 'candidate_surname', 'birth_date', 'horizontal', 'role_id', 'cv_summary', 'interviewers_ids', 'interview_date', 'feedback', 'notes', 'hiring_status', 'entry_date', 'status'], interviewRows);
};

const importSkills = async (client: any, body: any, warnings: string[]) => {
    const { skills, associations } = body;
    
    // 1. Import Skills Definitions
    if (Array.isArray(skills)) {
        const skillRows = skills.map(s => [
            uuidv4(), 
            s['Nome Competenza'] || s.name, 
            (s['Certificazione'] === 'SI' || s['Certificazione'] === 'Sì' || s.isCertification === true)
        ]);
        await executeBulkInsert(client, 'skills', ['id', 'name', 'is_certification'], skillRows);
    }

    // 2. Import Associations
    if (Array.isArray(associations)) {
        const resourceMap = new Map<string, string>((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
        const skillMap = new Map<string, string>((await client.query('SELECT id, name FROM skills')).rows.map((s: any) => [normalize(s.name), s.id]));
        
        const assocRows: any[][] = [];
        
        for (const assoc of associations) {
            const resName = String(assoc['Nome Risorsa'] || assoc.resourceName || '');
            const skillName = String(assoc['Nome Competenza'] || assoc.skillName || '');
            
            // Fix types
            const resId = resourceMap.get(normalize(resName));
            const skillId = skillMap.get(normalize(skillName));
            
            if (resId && skillId) {
                const acqDate = parseDate(assoc['Data Conseguimento'] || assoc.acquisitionDate);
                const expDate = parseDate(assoc['Data Scadenza'] || assoc.expirationDate);
                
                assocRows.push([
                    resId, 
                    skillId, 
                    assoc['Livello'] || assoc.level || 1,
                    formatDateForDB(acqDate),
                    formatDateForDB(expDate)
                ]);
            }
        }
        await executeBulkInsert(client, 'resource_skills', ['resource_id', 'skill_id', 'level', 'acquisition_date', 'expiration_date'], assocRows, 'ON CONFLICT (resource_id, skill_id) DO UPDATE SET level = EXCLUDED.level, acquisition_date = EXCLUDED.acquisition_date, expiration_date = EXCLUDED.expiration_date');
    }
};

const importLeaves = async (client: any, body: any, warnings: string[]) => {
    const { leaves } = body;
    if (!Array.isArray(leaves)) return;

    const resourceMap = new Map((await client.query('SELECT id, name FROM resources')).rows.map((r: any) => [normalize(r.name), r.id]));
    const typeMap = new Map((await client.query('SELECT id, name FROM leave_types')).rows.map((t: any) => [normalize(t.name), t.id]));
    
    const leaveRows: any[][] = [];
    
    for (const leave of leaves) {
        const resName = leave['Nome Risorsa'] || leave.resourceName;
        const resId = resourceMap.get(normalize(resName));
        
        const typeName = leave['Tipologia Assenza'] || leave.typeName;
        const typeId = typeMap.get(normalize(typeName));

        if (resId && typeId) {
             const startDate = parseDate(leave['Data Inizio'] || leave.startDate);
             const endDate = parseDate(leave['Data Fine'] || leave.endDate);
             
             // Approvers parsing (comma separated names)
             const approversString = leave['Approvatori'] || leave.approverNames;
             const approverIds: string[] = [];
             if (approversString && typeof approversString === 'string') {
                 approversString.split(',').forEach((n: string) => {
                     const id = resourceMap.get(normalize(n.trim()));
                     if (id) approverIds.push(id);
                 });
             }
             
             leaveRows.push([
                 uuidv4(),
                 resId,
                 typeId,
                 formatDateForDB(startDate),
                 formatDateForDB(endDate),
                 leave['Stato'] || leave.status || 'PENDING',
                 leave['Note'] || leave.notes,
                 approverIds,
                 (leave['Mezza Giornata'] === 'SI' || leave.isHalfDay === true)
             ]);
        } else {
             warnings.push(`Assenza saltata: Risorsa '${resName}' o Tipo '${typeName}' non trovati.`);
        }
    }

    if (leaveRows.length > 0) {
        await executeBulkInsert(client, 'leave_requests', ['id', 'resource_id', 'type_id', 'start_date', 'end_date', 'status', 'notes', 'approver_ids', 'is_half_day'], leaveRows);
    }
};

const importUsersPermissions = async (client: any, body: any, warnings: string[]) => {
     const { users, permissions } = body;
     
     // Users
     if (Array.isArray(users)) {
         const resourceMap = new Map((await client.query('SELECT id, email FROM resources')).rows.map((r: any) => [normalize(r.email), r.id]));
         const userRows: any[][] = [];
         
         for (const u of users) {
             const email = u['Email Risorsa'] || u.resourceEmail;
             const resourceId = email ? resourceMap.get(normalize(email)) : null;
             
             const username = u['Username'] || u.username;
             const role = u['Ruolo'] || u.role;
             const isActive = (u['Stato Attivo'] === 'SI' || u['Stato Attivo'] === 'Sì' || u.isActive === true);
             const dummyHash = '$2a$10$abcdef...'; 
             
             userRows.push([
                 uuidv4(),
                 username,
                 dummyHash,
                 role,
                 resourceId,
                 isActive
             ]);
         }
         
         if (userRows.length > 0) {
             await executeBulkInsert(
                 client, 
                 'app_users', 
                 ['id', 'username', 'password_hash', 'role', 'resource_id', 'is_active'], 
                 userRows, 
                 'ON CONFLICT (username) DO UPDATE SET role = EXCLUDED.role, resource_id = EXCLUDED.resource_id, is_active = EXCLUDED.is_active'
             );
         }
     }

     // Permissions
     if (Array.isArray(permissions)) {
         await client.query('DELETE FROM role_permissions'); 
         
         const permRows = permissions.map(p => [
             p['Ruolo'] || p.role,
             p['Pagina'] || p.pagePath,
             (p['Accesso Consentito'] === 'SI' || p['Accesso Consentito'] === 'Sì' || p.isAllowed === true)
         ]);
         
         await executeBulkInsert(client, 'role_permissions', ['role', 'page_path', 'is_allowed'], permRows);
     }
}

const importTutorMapping = async (client: any, body: any, warnings: string[]) => {
    const { mapping } = body;
    if (!Array.isArray(mapping)) return;
    
    const resourceMap = new Map<string, string>((await client.query('SELECT id, name, email FROM resources')).rows.map((r: any) => {
        return [normalize(r.name), r.id];
    }));
    // Add email mapping
    (await client.query('SELECT id, email FROM resources')).rows.forEach((r: any) => {
        if(r.email) resourceMap.set(normalize(r.email), r.id);
    });

    for (const row of mapping) {
        const resName = String(row['Risorsa'] || row.resourceName || '');
        const resEmail = String(row['Email Risorsa'] || row.resourceEmail || '');
        
        const resId = resourceMap.get(normalize(resEmail)) || resourceMap.get(normalize(resName));
        
        const tutorName = String(row['Tutor'] || row.tutorName || '');
        const tutorEmail = String(row['Email Tutor'] || row.tutorEmail || '');
        
        const tutorId = resourceMap.get(normalize(tutorEmail)) || resourceMap.get(normalize(tutorName));
        
        if (resId && tutorId) {
             await client.query('UPDATE resources SET tutor_id = $1 WHERE id = $2', [tutorId, resId]);
        }
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!verifyOperational(req)) {
        return res.status(403).json({ error: 'Unauthorized: Operational role required.' });
    }

    const { type } = req.query;
    const client = await db.connect();
    const warnings: string[] = [];

    try {
        await client.query('BEGIN');
        
        switch (type) {
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
                throw new Error('Invalid import type');
        }

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Importazione completata con successo.', warnings });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Import failed:', error);
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
