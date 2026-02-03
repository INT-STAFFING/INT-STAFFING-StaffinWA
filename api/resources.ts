
import { db } from './db.js';
import { ensureDbTablesExist } from './schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { notify } from '../utils/webhookNotifier.js';

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
    'notification_configs': 'notification_configs'
};

// --- ZOD SCHEMAS FOR VALIDATION ---
const VALIDATION_SCHEMAS: Record<string, z.ZodObject<any>> = {
    'resources': z.object({
        name: z.string(),
        email: z.string().email().optional().nullable(),
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
        overheadPct: z.number().optional().default(0),
        chargeablePct: z.number().optional().default(100),
        trainingPct: z.number().optional().default(0),
        bdPct: z.number().optional().default(0)
    }).refine(data => {
        // Validation: Sum of percentages must be 100
        const c = data.chargeablePct || 0;
        const t = data.trainingPct || 0;
        const b = data.bdPct || 0;
        // Allow tiny floating point errors
        return Math.abs((c + t + b) - 100) < 0.01;
    }, {
        message: "La somma delle percentuali (Chargeable + Training + BD) deve essere 100%",
        path: ["chargeablePct"] // Highlight chargeablePct field on error
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
        // password_hash handled separately or assumed existing/default if not passed here
    }),
    'notification_configs': z.object({
        eventType: z.string(),
        webhookUrl: z.string().trim().min(1, 'Webhook URL required'),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional().default(true)
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
             // Ensure numeric fields from DB (which might be strings for NUMERIC type) are numbers
             n[camelKey] = Number(value);
        } else {
            n[camelKey] = value;
        }
    }
    return n;
};

// --- NOTIFICATION DISPATCHER HELPER ---
const triggerNotification = async (client: any, method: string, tableName: string, id: string | null, data: any, oldData: any = null) => {
    try {
        // --- CREATIONS ---
        if (method === 'POST') {
            if (tableName === 'resources') {
                await notify(client, 'RESOURCE_CREATED', {
                    title: 'Nuova Risorsa Inserita',
                    color: 'Good',
                    facts: [{ name: 'Nome', value: data.name }, { name: 'Ruolo', value: data.roleId || 'N/A' }] // We assume roleId is passed, not resolved name
                });
            } else if (tableName === 'projects') {
                 await notify(client, 'PROJECT_CREATED', {
                    title: 'Nuovo Progetto Creato',
                    color: 'Good',
                    facts: [{ name: 'Progetto', value: data.name }, { name: 'Budget', value: `${data.budget} €` }]
                });
            } else if (tableName === 'contracts') {
                await notify(client, 'CONTRACT_CREATED', {
                    title: 'Nuovo Contratto',
                    color: 'Good',
                    facts: [{ name: 'Contratto', value: data.name }, { name: 'Capienza', value: `${data.capienza} €` }]
                });
            } else if (tableName === 'resource_skills') {
                // Fetch Names
                const resName = (await client.query('SELECT name FROM resources WHERE id = $1', [data.resourceId])).rows[0]?.name;
                const skillName = (await client.query('SELECT name FROM skills WHERE id = $1', [data.skillId])).rows[0]?.name;
                await notify(client, 'SKILL_ADDED', {
                    title: 'Nuova Competenza',
                    color: 'Accent',
                    facts: [{ name: 'Risorsa', value: resName }, { name: 'Skill', value: skillName }]
                });
            } else if (tableName === 'app_users') {
                 await notify(client, 'USER_CREATED', {
                    title: 'Nuovo Utente Sistema',
                    color: 'Warning',
                    facts: [{ name: 'Username', value: data.username }, { name: 'Ruolo', value: data.role }]
                });
            } else if (tableName === 'leave_requests') {
                 const resName = (await client.query('SELECT name FROM resources WHERE id = $1', [data.resourceId])).rows[0]?.name;
                 await notify(client, 'LEAVE_REQUEST_CREATED', {
                    title: 'Nuova Richiesta Assenza',
                    color: 'Accent',
                    facts: [{ name: 'Risorsa', value: resName }, { name: 'Periodo', value: `${data.startDate} - ${data.endDate}` }]
                });
            } else if (tableName === 'interviews') {
                 await notify(client, 'INTERVIEW_SCHEDULED', {
                    title: 'Nuovo Colloquio',
                    color: 'Accent',
                    facts: [{ name: 'Candidato', value: `${data.candidateName} ${data.candidateSurname}` }, { name: 'Data', value: data.interviewDate }]
                });
            }
        } 
        
        // --- UPDATES ---
        else if (method === 'PUT' && oldData) {
            if (tableName === 'resources') {
                if (!oldData.resigned && data.resigned) {
                    await notify(client, 'RESOURCE_RESIGNED', {
                        title: 'Dimissioni Risorsa',
                        color: 'Attention',
                        facts: [{ name: 'Risorsa', value: oldData.name }]
                    });
                } else {
                    // Generic update - maybe too noisy, skip for now or enable if specific fields change
                    await notify(client, 'RESOURCE_UPDATED', {
                        title: 'Anagrafica Aggiornata',
                        color: 'Good',
                        facts: [{ name: 'Risorsa', value: oldData.name }]
                    });
                }
            } else if (tableName === 'projects') {
                if (oldData.status !== data.status) {
                    await notify(client, 'PROJECT_STATUS_CHANGED', {
                        title: 'Cambio Stato Progetto',
                        color: 'Accent',
                        facts: [{ name: 'Progetto', value: oldData.name }, { name: 'Nuovo Stato', value: data.status }]
                    });
                }
                if (data.budget !== undefined && Number(oldData.budget) !== Number(data.budget)) {
                     await notify(client, 'BUDGET_UPDATED', {
                        title: 'Revisione Budget',
                        color: 'Warning',
                        facts: [{ name: 'Progetto', value: oldData.name }, { name: 'Nuovo Budget', value: `${data.budget} €` }]
                    });
                }
            } else if (tableName === 'leave_requests') {
                 if (oldData.status !== data.status) {
                     const resName = (await client.query('SELECT name FROM resources WHERE id = $1', [oldData.resource_id])).rows[0]?.name;
                     const event = data.status === 'APPROVED' ? 'LEAVE_APPROVED' : (data.status === 'REJECTED' ? 'LEAVE_REJECTED' : null);
                     if (event) {
                         await notify(client, event, {
                            title: event === 'LEAVE_APPROVED' ? 'Assenza Approvata' : 'Assenza Rifiutata',
                            color: event === 'LEAVE_APPROVED' ? 'Good' : 'Attention',
                            facts: [{ name: 'Risorsa', value: resName }, { name: 'Stato', value: data.status }]
                        });
                     }
                 }
            } else if (tableName === 'interviews') {
                 if (data.feedback && data.feedback !== oldData.feedback) {
                      await notify(client, 'INTERVIEW_FEEDBACK', {
                        title: 'Feedback Colloquio',
                        color: data.feedback === 'Positivo' ? 'Good' : 'Warning',
                        facts: [{ name: 'Candidato', value: `${oldData.candidate_name} ${oldData.candidate_surname}` }, { name: 'Feedback', value: data.feedback }]
                    });
                 }
                 if (data.hiringStatus === 'SI' && oldData.hiring_status !== 'SI') {
                      await notify(client, 'CANDIDATE_HIRED', {
                        title: 'Candidato Assunto',
                        color: 'Good',
                        facts: [{ name: 'Candidato', value: `${oldData.candidate_name} ${oldData.candidate_surname}` }]
                    });
                 }
            }
        }
        
        // Custom Action: Password Reset
        else if (method === 'CUSTOM_PWD' && tableName === 'app_users') {
            await notify(client, 'PASSWORD_RESET', {
                title: 'Reset Password',
                color: 'Warning',
                facts: [{ name: 'Utente', value: data.username }]
            });
        }
        
    } catch (err) {
        console.error("Notification Dispatch Error:", err);
    }
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action } = req.query;
    
    await ensureDbTablesExist(db);
    const client = await db.connect();
    const currentUser = getUserFromRequest(req);
    const tableName = TABLE_MAPPING[entity as string] || entity;

    try {
        // --- CUSTOM ACTIONS ---
        
        // Password Change / Reset
        if (entity === 'app-users' && action === 'change_password' && id && method === 'PUT') {
             if (!currentUser || (!verifyAdmin(req) && currentUser.id !== id)) return res.status(403).json({ error: 'Unauthorized' });
             
             const { newPassword } = req.body;
             if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password too short' });
             
             const hash = await bcrypt.hash(newPassword, 10);
             await client.query('UPDATE app_users SET password_hash = $1, must_change_password = $2 WHERE id = $3', [hash, false, id]);
             
             const userRes = await client.query('SELECT username FROM app_users WHERE id = $1', [id]);
             await triggerNotification(client, 'CUSTOM_PWD', 'app_users', id as string, { username: userRes.rows[0]?.username });
             
             await logAction(client, currentUser, 'CHANGE_PASSWORD', 'app_users', id as string, {}, req);
             return res.status(200).json({ success: true });
        }
        
        // Impersonate
        if (entity === 'app-users' && action === 'impersonate' && id && method === 'POST') {
             if (!verifyAdmin(req)) return res.status(403).json({ error: 'Admin only' });
             
             const { rows } = await client.query('SELECT * FROM app_users WHERE id = $1', [id]);
             const targetUser = rows[0];
             if (!targetUser) return res.status(404).json({ error: 'User not found' });
             
             const token = jwt.sign(
                { userId: targetUser.id, username: targetUser.username, role: targetUser.role },
                JWT_SECRET!,
                { expiresIn: '1h' }
            );
            
            // Get permissions for the target role
            const permRes = await client.query(`SELECT page_path FROM role_permissions WHERE role = $1 AND is_allowed = TRUE`, [targetUser.role]);
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
        
        // Bulk Password Reset
         if (entity === 'app-users' && action === 'bulk_password_reset' && method === 'POST') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Admin only' });
            
            const { users } = req.body; // array of { username, password }
            if (!Array.isArray(users)) return res.status(400).json({ error: 'Invalid data' });

            let successCount = 0;
            let failCount = 0;

            for (const u of users) {
                try {
                    const hash = await bcrypt.hash(u.password, 10);
                    const res = await client.query(
                        'UPDATE app_users SET password_hash = $1, must_change_password = TRUE WHERE username = $2', 
                        [hash, u.username]
                    );
                    if ((res.rowCount ?? 0) > 0) {
                        successCount++;
                         // Optional: Notify individual resets? Too noisy for bulk.
                    } else {
                        failCount++;
                    }
                } catch (e) {
                    failCount++;
                }
            }
            
            await logAction(client, currentUser, 'BULK_PWD_RESET', 'app_users', null, { successCount, failCount }, req);
            return res.status(200).json({ successCount, failCount });
         }

        // --- CUSTOM HANDLER: ANALYTICS RECALCULATION (Heavy Task) ---
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
                
                const kpiData = {
                    totalBudget,
                    activeResources,
                    lastUpdated: new Date().toISOString(),
                    note: "Calculated via Async Process"
                };

                await client.query(`
                    INSERT INTO analytics_cache (key, data, scope) 
                    VALUES ('dashboard_kpi_current', $1, 'DASHBOARD')
                    ON CONFLICT (key) 
                    DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
                `, [JSON.stringify(kpiData)]);
                
                await client.query('COMMIT');
                return res.status(200).json({ success: true, message: 'Analytics recalculated successfully' });
             } catch (calcError) {
                 await client.query('ROLLBACK');
                 return res.status(500).json({ error: 'Recalculation failed' });
             }
        }

        if (method === 'POST' && entity === 'resources' && action === 'best_fit') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             // Placeholder logic
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
        
        // --- CUSTOM HANDLER FOR ROLE PERMISSIONS (RBAC) ---
        if (entity === 'role-permissions' && method === 'POST') {
             if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
             const { permissions } = req.body;
             if (Array.isArray(permissions)) {
                 await client.query('BEGIN');
                 // Simple full refresh strategy or upsert
                 await client.query('DELETE FROM role_permissions'); // Clear old
                 for (const p of permissions) {
                     await client.query(
                         `INSERT INTO role_permissions (role, page_path, is_allowed) VALUES ($1, $2, $3)`, 
                         [p.role, p.pagePath, p.isAllowed]
                     );
                 }
                 await client.query('COMMIT');
                 return res.status(200).json({ success: true });
             }
             return res.status(400).json({ error: 'Invalid permissions format' });
        }

        // --- GENERIC GET ---
        if (method === 'GET') {
            const sensitiveEntities = ['app-users', 'role-permissions', 'audit_logs', 'db_inspector', 'theme', 'security-users'];
            if (sensitiveEntities.includes(entity as string) && !verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

            let queryStr = `SELECT * FROM ${tableName}`;
            const params = [];
            
            if (id) {
                queryStr += ` WHERE id = $1`;
                params.push(id);
            }
            
            // Audit Log Filtering
            if (entity === 'audit_logs') {
                const conditions = [];
                const q = req.query;
                let idx = 1;
                if (q.username) { conditions.push(`username ILIKE $${idx++}`); params.push(`%${q.username}%`); }
                if (q.actionType) { conditions.push(`action = $${idx++}`); params.push(q.actionType); }
                if (q.targetEntity) { conditions.push(`entity = $${idx++}`); params.push(q.targetEntity); } // Mapped filter to DB column
                if (q.entityId) { conditions.push(`entity_id = $${idx++}`); params.push(q.entityId); }
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
             
             // VALIDATION STEP
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

             // Logic for Roles: auto-calculate dailyExpenses from overheadPct
             if (tableName === 'roles') {
                const dailyCost = validatedBody.dailyCost || 0;
                const overheadPct = validatedBody.overheadPct || 0;
                // Force calculate absolute value for DB compatibility
                validatedBody.dailyExpenses = (dailyCost * overheadPct) / 100;
             }
             
             // Dynamic Query Construction using Validated Keys Only
             const columns = Object.keys(validatedBody).map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
             const values = Object.values(validatedBody);
             const placeholders = values.map((_, i) => `$${i + 2}`); // $1 is reserved for ID
             
             const q = `INSERT INTO ${tableName} (id, ${columns.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`;
             await client.query(q, [newId, ...values]);
             
             await logAction(client, currentUser, 'CREATE', tableName as string, newId, validatedBody, req);
             
             // --- NOTIFICATION TRIGGER ---
             await triggerNotification(client, 'POST', tableName as string, newId, validatedBody);
             // -----------------------------

             return res.status(201).json({ id: newId, ...validatedBody });
        }

        // --- GENERIC PUT (UPDATE) ---
        if (method === 'PUT') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            
            // VALIDATION STEP
             const schema = VALIDATION_SCHEMAS[tableName as string];
             if (!schema) {
                 return res.status(400).json({ error: `Entity ${entity} is not supported for generic write operations.` });
             }
             
             // Use partial() for updates as not all fields might be present
             // NOTE: for Roles with refinement, we might need full object or manual check if fields missing
             const parseResult = schema.partial().safeParse(req.body);
             if (!parseResult.success) {
                 return res.status(400).json({ error: "Invalid input data", details: parseResult.error.format() });
             }

            let validatedBody = parseResult.data;
            
            // Logic for Roles: auto-calculate dailyExpenses from overheadPct if present
            if (tableName === 'roles') {
                if (validatedBody.dailyCost !== undefined && validatedBody.overheadPct !== undefined) {
                     validatedBody.dailyExpenses = (Number(validatedBody.dailyCost || 0) * Number(validatedBody.overheadPct || 0)) / 100;
                } else if (validatedBody.overheadPct !== undefined) {
                     const { rows } = await client.query('SELECT daily_cost FROM roles WHERE id = $1', [id]);
                     const currentCost = Number(rows[0]?.daily_cost || 0);
                     validatedBody.dailyExpenses = (currentCost * Number(validatedBody.overheadPct || 0)) / 100;
                } else if (validatedBody.dailyCost !== undefined) {
                     const { rows } = await client.query('SELECT overhead_pct FROM roles WHERE id = $1', [id]);
                     const currentPct = Number(rows[0]?.overhead_pct || 0);
                     validatedBody.dailyExpenses = (Number(validatedBody.dailyCost || 0) * currentPct) / 100;
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

            // --- FETCH OLD DATA FOR NOTIFICATIONS ---
            const oldDataRes = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
            const oldData = oldDataRes.rows[0];
            // ----------------------------------------

            const q = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${values.length + 1}`;
            await client.query(q, [...values, id]);
            
            await logAction(client, currentUser, 'UPDATE', tableName as string, id as string, validatedBody, req);
            
            // --- NOTIFICATION TRIGGER ---
            await triggerNotification(client, 'PUT', tableName as string, id as string, validatedBody, oldData ? toCamelAndNormalize(oldData) : null);
            // -----------------------------

            return res.status(200).json({ id, ...validatedBody });
        }

        // --- GENERIC DELETE ---
        if (method === 'DELETE') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             // Specific Admin Check for sensitive entities moved to GET or explicit blocks
             if (['notification_configs'].includes(tableName as string) && !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             
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
