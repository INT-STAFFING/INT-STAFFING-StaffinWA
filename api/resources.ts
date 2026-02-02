
import { db } from './db.js';
import { ensureDbTablesExist } from './schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { notify, generateTeamsMentions } from '../services/notificationService';

const JWT_SECRET = process.env.JWT_SECRET;

const OPERATIONAL_ROLES = ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];

const verifyAdmin = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        return decoded.role === 'ADMIN';
    } catch (e) { return false; }
};

const getUserFromRequest = (req: VercelRequest) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        return { id: decoded.userId, username: decoded.username, role: decoded.role };
    } catch (e) { return null; }
};

const logAction = async (client: any, user: any, action: string, entity: string, entityId: string | null, details: any, req: VercelRequest) => {
    try {
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
        await client.query(
            `INSERT INTO action_logs (user_id, username, action, entity, entity_id, details, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [user?.id || null, user?.username || 'system', action, entity, entityId, JSON.stringify(details), ip]
        );
    } catch (e) { console.error("Audit log failed:", e); }
};

const TABLE_MAPPING: Record<string, string> = {
    'leaves': 'leave_requests',
    'leave_types': 'leave_types',
    'role-permissions': 'role_permissions',
    'role_permissions': 'role_permissions',
    'security-users': 'app_users',
    'app-users': 'app_users',
    'rate_cards': 'rate_cards',
    'rate_card_entries': 'rate_card_entries',
    'project_expenses': 'project_expenses',
    'billing_milestones': 'billing_milestones',
    'audit_logs': 'action_logs',
    'analytics_cache': 'analytics_cache',
    'webhook_integrations': 'webhook_integrations'
};

// --- ZOD SCHEMAS FOR VALIDATION ---
// NOTE: Custom Zod implementation in libs/zod.ts does NOT support .email(), .url(), .default().
// Use simple string() and optional(), handle validation regex and defaults in code.
const VALIDATION_SCHEMAS: Record<string, z.ZodObject<any>> = {
    'resources': z.object({
        name: z.string(),
        email: z.string().optional().nullable(),
        roleId: z.string().optional().nullable(),
        horizontal: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
        hireDate: z.string().optional().nullable(),
        workSeniority: z.number().optional().nullable(),
        notes: z.string().optional().nullable(),
        maxStaffingPercentage: z.number().optional().nullable(),
        resigned: z.boolean().optional().nullable(),
        lastDayOfWork: z.string().optional().nullable(),
        tutorId: z.string().optional().nullable(),
        dailyCost: z.number().optional().nullable()
    }),
    'projects': z.object({
        name: z.string(),
        clientId: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        budget: z.number().optional().nullable(),
        realizationPercentage: z.number().optional().nullable(),
        projectManager: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        contractId: z.string().optional().nullable(),
        billingType: z.string().optional().nullable()
    }),
    'clients': z.object({
        name: z.string(),
        sector: z.string().optional().nullable(),
        contactEmail: z.string().optional().nullable()
    }),
    'roles': z.object({
        name: z.string(),
        seniorityLevel: z.string().optional().nullable(),
        dailyCost: z.number().optional().nullable(),
        standardCost: z.number().optional().nullable(),
        dailyExpenses: z.number().optional().nullable(),
        overheadPct: z.number().optional(),
        chargeablePct: z.number().optional(),
        trainingPct: z.number().optional(),
        bdPct: z.number().optional()
    }).refine(data => {
        // Validation: Sum of percentages must be 100 IF they are provided
        const c = data.chargeablePct ?? 100;
        const t = data.trainingPct ?? 0;
        const b = data.bdPct ?? 0;
        // Allow tiny floating point errors
        return Math.abs((c + t + b) - 100) < 0.01;
    }, {
        message: "La somma delle percentuali (Chargeable + Training + BD) deve essere 100%",
        path: ["chargeablePct"]
    }),
    'skills': z.object({
        name: z.string(),
        isCertification: z.boolean().optional().nullable()
    }),
    'leave_types': z.object({
        name: z.string(),
        color: z.string().optional().nullable(),
        requiresApproval: z.boolean().optional().nullable(),
        affectsCapacity: z.boolean().optional().nullable()
    }),
    'rate_cards': z.object({
        name: z.string(),
        currency: z.string().optional().nullable()
    }),
    'project_expenses': z.object({
        projectId: z.string(),
        category: z.string(),
        description: z.string().optional().nullable(),
        amount: z.number(),
        date: z.string(),
        billable: z.boolean().optional().nullable()
    }),
    'billing_milestones': z.object({
        projectId: z.string(),
        name: z.string(),
        date: z.string(),
        amount: z.number(),
        status: z.string().optional().nullable()
    }),
    'contracts': z.object({
        name: z.string(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        cig: z.string(),
        cigDerivato: z.string().optional().nullable(),
        wbs: z.string().optional().nullable(),
        capienza: z.number(),
        backlog: z.number().optional().nullable(),
        rateCardId: z.string().optional().nullable(),
        billingType: z.string().optional().nullable()
    }),
    'app_users': z.object({
        username: z.string(),
        role: z.string(),
        resourceId: z.string().optional().nullable(),
        isActive: z.boolean().optional().nullable()
    }),
    'webhook_integrations': z.object({
        eventType: z.string(),
        targetUrl: z.string(), // Removed .url()
        templateJson: z.string().refine((val) => {
            try { JSON.parse(val); return true; } catch { return false; }
        }, "Il template deve essere un JSON valido"),
        description: z.string().optional(),
        isActive: z.boolean().optional() // Removed .default(true)
    })
};

const toCamelAndNormalize = (o: any) => {
    if (!o) return {};
    const n: any = {};
    for (const k in o) {
        const camelKey = k.replace(/(_\w)/g, m => m[1].toUpperCase());
        const value = o[k];
        
        if (value instanceof Date && 
           (camelKey.endsWith('Date') || camelKey === 'date' || camelKey === 'lastDayOfWork')) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            n[camelKey] = `${y}-${m}-${d}`;
        } else if (typeof value === 'string' && !isNaN(Number(value)) && 
                   (camelKey.endsWith('Pct') || camelKey === 'dailyCost' || camelKey === 'standardCost' || camelKey === 'dailyExpenses' || camelKey === 'overheadPct')) {
             n[camelKey] = Number(value);
        } else {
            n[camelKey] = value;
        }
    }
    return n;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action } = req.query;
    
    await ensureDbTablesExist(db);
    const client = await db.connect();
    const currentUser = getUserFromRequest(req);
    const tableName = TABLE_MAPPING[entity as string] || entity;

    try {
        // --- CUSTOM HANDLERS ---
        if (entity === 'app-users' && action === 'change_password' && method === 'PUT') {
            if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
            if (currentUser.role !== 'ADMIN' && currentUser.id !== id) {
                 return res.status(403).json({ error: 'Forbidden' });
            }
            const { newPassword } = req.body;
            if (!newPassword || newPassword.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters' });
            }
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(newPassword, salt);
            await client.query(`UPDATE app_users SET password_hash = $1, must_change_password = FALSE WHERE id = $2`, [hash, id]);
            await logAction(client, currentUser, 'CHANGE_PASSWORD', 'app_users', id as string, {}, req);
            return res.status(200).json({ success: true });
        }

        if (entity === 'app-users' && action === 'bulk_password_reset' && method === 'POST') {
             if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
             const { users } = req.body;
             if (!Array.isArray(users)) return res.status(400).json({ error: 'Invalid input format' });

             let successCount = 0;
             let failCount = 0;
             for (const u of users) {
                 try {
                     if (!u.password || u.password.length < 8) { failCount++; continue; }
                     const salt = await bcrypt.genSalt(10);
                     const hash = await bcrypt.hash(u.password, salt);
                     const res = await client.query(`UPDATE app_users SET password_hash = $1, must_change_password = TRUE WHERE username = $2`, [hash, u.username]);
                     if (res.rowCount && res.rowCount > 0) successCount++; else failCount++;
                 } catch (e) { failCount++; }
             }
             await logAction(client, currentUser, 'BULK_PASSWORD_RESET', 'app_users', null, { successCount, failCount }, req);
             return res.status(200).json({ success: true, successCount, failCount });
        }

        if (entity === 'app-users' && action === 'impersonate' && method === 'POST') {
             if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
             const targetRes = await client.query('SELECT * FROM app_users WHERE id = $1', [id]);
             const targetUser = targetRes.rows[0];
             if (!targetUser) return res.status(404).json({ error: 'User not found' });
             const token = jwt.sign(
                { userId: targetUser.id, username: targetUser.username, role: targetUser.role },
                JWT_SECRET!,
                { expiresIn: '1h' }
            );
            const permRes = await client.query('SELECT page_path FROM role_permissions WHERE role = $1 AND is_allowed = TRUE', [targetUser.role]);
            const permissions = permRes.rows.map(r => r.page_path);
            await logAction(client, currentUser, 'IMPERSONATE', 'app_users', id as string, { target: targetUser.username }, req);
            return res.status(200).json({
                success: true,
                token,
                user: {
                    id: targetUser.id,
                    username: targetUser.username,
                    role: targetUser.role,
                    resourceId: targetUser.resource_id,
                    permissions,
                    mustChangePassword: false
                }
            });
        }

        if (entity === 'analytics_cache' && action === 'recalc_all' && method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) {
                 return res.status(403).json({ error: 'Unauthorized' });
             }
             try {
                await client.query('BEGIN');
                const budgetRes = await client.query(`SELECT SUM(budget) as total FROM projects WHERE status = 'In corso'`);
                const totalBudget = parseFloat(budgetRes.rows[0]?.total || '0');
                const resRes = await client.query(`SELECT COUNT(*) as count FROM resources WHERE resigned = false`);
                const activeResources = parseInt(resRes.rows[0]?.count || '0', 10);
                const kpiData = { totalBudget, activeResources, lastUpdated: new Date().toISOString(), note: "Calculated via Async Process" };
                await client.query(`INSERT INTO analytics_cache (key, data, scope) VALUES ('dashboard_kpi_current', $1, 'DASHBOARD') ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`, [JSON.stringify(kpiData)]);
                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: 'Analytics recalculated successfully' });
             } catch (calcError) {
                 await client.query('ROLLBACK');
                 return res.status(500).json({ error: 'Recalculation failed' });
             }
        }

        if (method === 'POST' && entity === 'resources' && action === 'best_fit') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             return res.status(200).json([]);
        }

        if (entity === 'app-config-batch' && method === 'POST') {
             if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
             const { updates } = req.body;
             if (Array.isArray(updates)) {
                 await client.query('BEGIN');
                 for (const item of updates) {
                     await client.query(`INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [item.key, item.value]);
                 }
                 await client.query('COMMIT');
                 await logAction(client, currentUser, 'UPDATE_BATCH', 'app_config', null, { keys: updates.map(u => u.key) }, req);
                 return res.status(200).json({ success: true });
             }
             return res.status(400).json({ error: 'Invalid updates format' });
        }
        
        if (entity === 'role-permissions' && method === 'POST') {
             if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
             const { permissions } = req.body;
             if (Array.isArray(permissions)) {
                 await client.query('BEGIN');
                 await client.query('DELETE FROM role_permissions');
                 for (const p of permissions) {
                     await client.query(`INSERT INTO role_permissions (role, page_path, is_allowed) VALUES ($1, $2, $3)`, [p.role, p.pagePath, p.isAllowed]);
                 }
                 await client.query('COMMIT');
                 return res.status(200).json({ success: true });
             }
             return res.status(400).json({ error: 'Invalid permissions format' });
        }

        // --- GENERIC GET ---
        if (method === 'GET') {
            const sensitiveEntities = ['app-users', 'role-permissions', 'audit_logs', 'db_inspector', 'theme', 'security-users', 'webhook_integrations'];
            if (sensitiveEntities.includes(entity as string) && !verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

            let queryStr = `SELECT * FROM ${tableName}`;
            const params = [];
            
            if (id) {
                queryStr += ` WHERE id = $1`;
                params.push(id);
            }
            
            if (entity === 'audit_logs') {
                const conditions = [];
                const q = req.query;
                let idx = 1;
                if (q.username) { conditions.push(`username ILIKE $${idx++}`); params.push(`%${q.username}%`); }
                if (q.startDate) { conditions.push(`created_at >= $${idx++}`); params.push(q.startDate); }
                if (q.endDate) { conditions.push(`created_at <= $${idx++}`); params.push(q.endDate); }
                if (conditions.length > 0) queryStr += ' WHERE ' + conditions.join(' AND ');
                queryStr += ' ORDER BY created_at DESC';
                if (q.limit) { queryStr += ` LIMIT $${idx++}`; params.push(q.limit); }
            }

            const { rows } = await client.query(queryStr, params);
            if (id) {
                return res.status(200).json(rows.length > 0 ? toCamelAndNormalize(rows[0]) : null);
            }
            return res.status(200).json(rows.map(toCamelAndNormalize));
        }

        // --- GENERIC POST (INSERT) ---
        if (method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             
             const schema = VALIDATION_SCHEMAS[tableName as string];
             if (!schema) {
                 return res.status(400).json({ error: `Entity ${entity} is not supported for generic write operations.` });
             }
             
             const parseResult = schema.safeParse(req.body);
             if (!parseResult.success) {
                 return res.status(400).json({ error: "Invalid input data", details: parseResult.error.format() });
             }
             
             let validatedBody = parseResult.data;
             const newId = uuidv4();

             // Apply Defaults Manually (Since custom Zod doesn't support .default())
             if (tableName === 'roles') {
                validatedBody.overheadPct = validatedBody.overheadPct ?? 0;
                validatedBody.chargeablePct = validatedBody.chargeablePct ?? 100;
                validatedBody.trainingPct = validatedBody.trainingPct ?? 0;
                validatedBody.bdPct = validatedBody.bdPct ?? 0;
                
                const dailyCost = validatedBody.dailyCost || 0;
                validatedBody.dailyExpenses = (dailyCost * validatedBody.overheadPct) / 100;
             }

             if (tableName === 'webhook_integrations') {
                 validatedBody.isActive = validatedBody.isActive ?? true;
             }
             
             const columns = Object.keys(validatedBody).map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
             const values = Object.values(validatedBody);
             const placeholders = values.map((_, i) => `$${i + 2}`);
             
             const q = `INSERT INTO ${tableName} (id, ${columns.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`;
             await client.query(q, [newId, ...values]);
             
             await logAction(client, currentUser, 'CREATE', tableName as string, newId, validatedBody, req);

             if (tableName === 'leave_requests') {
                 const resRes = await client.query('SELECT name FROM resources WHERE id = $1', [validatedBody.resourceId]);
                 const resourceName = resRes.rows[0]?.name || 'Utente Sconosciuto';
                 let approverUsers = [];
                 if (validatedBody.approverIds && validatedBody.approverIds.length > 0) {
                     const approversRes = await client.query('SELECT name, email FROM resources WHERE id = ANY($1)', [validatedBody.approverIds]);
                     approverUsers = approversRes.rows;
                 }
                 const mentionsData = generateTeamsMentions(approverUsers);
                 await notify(client, 'LEAVE_REQ_CREATED', { requestorName: resourceName, startDate: validatedBody.startDate, endDate: validatedBody.endDate, notes: validatedBody.notes || "Nessuna nota.", ...mentionsData });
             }

             if (tableName === 'projects') {
                 let clientName = 'N/D';
                 if (validatedBody.clientId) {
                     const clientRes = await client.query('SELECT name FROM clients WHERE id = $1', [validatedBody.clientId]);
                     clientName = clientRes.rows[0]?.name || 'N/D';
                 }
                 await notify(client, 'PROJECT_CREATED', { projectName: validatedBody.name, clientName: clientName, startDate: validatedBody.startDate || 'N/D', projectManager: validatedBody.projectManager || 'N/D', budget: validatedBody.budget || 0 });
             }

             if (tableName === 'interviews') {
                 let interviewers = [];
                 if (validatedBody.interviewersIds && validatedBody.interviewersIds.length > 0) {
                     const intRes = await client.query('SELECT name, email FROM resources WHERE id = ANY($1)', [validatedBody.interviewersIds]);
                     interviewers = intRes.rows;
                 }
                 const mentionsData = generateTeamsMentions(interviewers);
                 let roleName = 'N/D';
                 if (validatedBody.roleId) {
                     const roleRes = await client.query('SELECT name FROM roles WHERE id = $1', [validatedBody.roleId]);
                     roleName = roleRes.rows[0]?.name || 'N/D';
                 }
                 await notify(client, 'INTERVIEW_SCHEDULED', { candidateName: validatedBody.candidateName, candidateSurname: validatedBody.candidateSurname, interviewDate: validatedBody.interviewDate, roleName: roleName, ...mentionsData });
             }

             return res.status(201).json({ id: newId, ...validatedBody });
        }

        // --- GENERIC PUT (UPDATE) ---
        if (method === 'PUT') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            
             const schema = VALIDATION_SCHEMAS[tableName as string];
             if (!schema) {
                 return res.status(400).json({ error: `Entity ${entity} is not supported for generic write operations.` });
             }
             
             const parseResult = schema.partial().safeParse(req.body);
             if (!parseResult.success) {
                 return res.status(400).json({ error: "Invalid input data", details: parseResult.error.format() });
             }

            let validatedBody = parseResult.data;
            
            if (tableName === 'roles') {
                if (validatedBody.dailyCost !== undefined && validatedBody.overheadPct !== undefined) {
                     validatedBody.dailyExpenses = (validatedBody.dailyCost * validatedBody.overheadPct) / 100;
                } else if (validatedBody.overheadPct !== undefined) {
                     const { rows } = await client.query('SELECT daily_cost FROM roles WHERE id = $1', [id]);
                     const currentCost = Number(rows[0]?.daily_cost || 0);
                     validatedBody.dailyExpenses = (currentCost * validatedBody.overheadPct) / 100;
                } else if (validatedBody.dailyCost !== undefined) {
                     const { rows } = await client.query('SELECT overhead_pct FROM roles WHERE id = $1', [id]);
                     const currentPct = Number(rows[0]?.overhead_pct || 0);
                     validatedBody.dailyExpenses = (validatedBody.dailyCost * currentPct) / 100;
                }
            }

            const updates = Object.entries(validatedBody).map(([k, v], i) => {
                const col = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                return `${col} = $${i + 1}`;
            });
            const values = Object.values(validatedBody);
            
            if (updates.length === 0) {
                 return res.status(400).json({ error: "No valid fields to update." });
            }

            const q = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${values.length + 1}`;
            await client.query(q, [...values, id]);
            
            await logAction(client, currentUser, 'UPDATE', tableName as string, id as string, validatedBody, req);

            if (tableName === 'leave_requests' && validatedBody.status) {
                const reqRes = await client.query('SELECT resource_id, notes, start_date, end_date FROM leave_requests WHERE id = $1', [id]);
                if (reqRes.rows.length > 0) {
                    const request = reqRes.rows[0];
                    const resInfo = await client.query('SELECT name, email FROM resources WHERE id = $1', [request.resource_id]);
                    const requestor = resInfo.rows[0];
                    if (requestor) {
                        const mentionsData = generateTeamsMentions([requestor]);
                        await notify(client, 'LEAVE_REQ_STATUS_CHANGE', { status: validatedBody.status, requestorName: requestor.name, notes: request.notes, startDate: request.start_date, endDate: request.end_date, ...mentionsData });
                    }
                }
            }

            return res.status(200).json({ id, ...validatedBody });
        }

        // --- GENERIC DELETE ---
        if (method === 'DELETE') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
             await logAction(client, currentUser, 'DELETE', tableName as string, id as string, {}, req);
             return res.status(204).end();
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);

    } catch (error) {
        try { await client.query('ROLLBACK'); } catch(e) {}
        console.error("API Error:", error);
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
