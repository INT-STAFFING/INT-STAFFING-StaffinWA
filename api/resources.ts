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
        return { id: decoded.userId, username: decoded.username, role: decoded.role, resourceId: decoded.resourceId };
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

// --- ZOD SCHEMAS ---
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
        dailyCost: z.number().optional().nullable(),
        version: z.number().optional()
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
        billingType: z.string().optional().nullable(),
        version: z.number().optional()
    }),
    'clients': z.object({
        name: z.string(),
        sector: z.string().optional().nullable(),
        contactEmail: z.string().optional().nullable(),
        version: z.number().optional()
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
        bdPct: z.number().optional().default(0),
        version: z.number().optional()
    }),
    'skills': z.object({
        name: z.string(),
        isCertification: z.boolean().optional().nullable()
    }),
    'leave_types': z.object({
        name: z.string(),
        color: z.string().optional().nullable(),
        requiresApproval: z.boolean().optional().nullable(),
        affects_capacity: z.boolean().optional().nullable()
    }),
    'leave_requests': z.object({
        resourceId: z.string(),
        typeId: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        status: z.string().optional().default('PENDING'),
        managerId: z.string().optional().nullable(),
        approverIds: z.array(z.string()).optional().nullable(),
        notes: z.string().optional().nullable(),
        isHalfDay: z.boolean().optional().nullable(),
        version: z.number().optional()
    }),
    'notification_configs': z.object({
        eventType: z.string(),
        webhookUrl: z.string().trim().min(1),
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
        if (value instanceof Date && (camelKey.endsWith('Date') || camelKey === 'date' || camelKey === 'lastDayOfWork')) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            n[camelKey] = `${y}-${m}-${d}`;
        } else {
            n[camelKey] = value;
        }
    }
    return n;
};

// --- HELPER: CREATE INTERNAL NOTIFICATION ---
const createInAppNotification = async (client: any, recipientId: string | null, title: string, message: string, link: string = '') => {
    if (!recipientId) {
        // Broadcast to Admins if no specific recipient
        const admins = await client.query("SELECT resource_id FROM app_users WHERE role = 'ADMIN' AND resource_id IS NOT NULL");
        for (const admin of admins.rows) {
            await client.query(
                `INSERT INTO notifications (id, recipient_resource_id, title, message, link, is_read) 
                 VALUES ($1, $2, $3, $4, $5, false)`,
                [uuidv4(), admin.resource_id, title, message, link]
            );
        }
    } else {
        await client.query(
            `INSERT INTO notifications (id, recipient_resource_id, title, message, link, is_read) 
             VALUES ($1, $2, $3, $4, $5, false)`,
            [uuidv4(), recipientId, title, message, link]
        );
    }
};

// --- NOTIFICATION DISPATCHER ---
const triggerNotification = async (client: any, method: string, tableName: string, id: string | null, data: any, oldData: any = null) => {
    try {
        if (method === 'POST') {
            if (tableName === 'resources') {
                await notify(client, 'RESOURCE_CREATED', { title: 'Nuova Risorsa', facts: [{ name: 'Nome', value: data.name }] });
                await createInAppNotification(client, null, 'Nuova Risorsa', `${data.name} è stata inserita nel sistema.`, '/resources');
            } else if (tableName === 'projects') {
                await notify(client, 'PROJECT_CREATED', { title: 'Nuovo Progetto', facts: [{ name: 'Nome', value: data.name }] });
                await createInAppNotification(client, null, 'Nuovo Progetto', `Il progetto "${data.name}" è stato creato.`, '/projects');
            } else if (tableName === 'resource_skills') {
                const resName = (await client.query('SELECT name FROM resources WHERE id = $1', [data.resourceId])).rows[0]?.name;
                const skillName = (await client.query('SELECT name FROM skills WHERE id = $1', [data.skillId])).rows[0]?.name;
                await notify(client, 'SKILL_ADDED', { title: 'Nuova Competenza', facts: [{ name: 'Risorsa', value: resName }, { name: 'Skill', value: skillName }] });
                await createInAppNotification(client, data.resourceId, 'Competenza Acquisita', `Hai ottenuto la competenza: ${skillName}.`, '/skills-map');
            } else if (tableName === 'leave_requests') {
                const resName = (await client.query('SELECT name FROM resources WHERE id = $1', [data.resourceId])).rows[0]?.name;
                await notify(client, 'LEAVE_REQUEST_CREATED', { title: 'Richiesta Assenza', facts: [{ name: 'Risorsa', value: resName }] });
                if (Array.isArray(data.approverIds)) {
                    for (const approverId of data.approverIds) {
                        await createInAppNotification(client, approverId, 'Approvazione Assenza', `${resName} ha richiesto ferie dal ${data.startDate}.`, '/leaves');
                    }
                }
            }
        } else if (method === 'PUT' && oldData) {
            if (tableName === 'leave_requests' && oldData.status !== data.status) {
                const resName = (await client.query('SELECT name FROM resources WHERE id = $1', [oldData.resource_id])).rows[0]?.name;
                const event = data.status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED';
                await notify(client, event, { title: 'Esito Assenza', facts: [{ name: 'Risorsa', value: resName }, { name: 'Stato', value: data.status }] });
                await createInAppNotification(client, oldData.resource_id, 'Esito Richiesta Assenza', `La tua richiesta dal ${oldData.start_date} è stata ${data.status === 'APPROVED' ? 'Approvata' : 'Rifiutata'}.`, '/leaves');
            }
        }
    } catch (err) { console.error("Notification Error:", err); }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action } = req.query;
    await ensureDbTablesExist(db);
    const client = await db.connect();
    const currentUser = getUserFromRequest(req);
    const tableName = TABLE_MAPPING[entity as string] || entity;

    try {
        if (action === 'mark_read' && entity === 'notifications') {
            if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
            // Determine resourceId of current user
            const uRes = await client.query('SELECT resource_id FROM app_users WHERE id = $1', [currentUser.id]);
            const resourceId = uRes.rows[0]?.resource_id;
            if (!resourceId) return res.status(400).json({ error: 'User has no associated resource' });

            if (id) {
                await client.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_resource_id = $2', [id, resourceId]);
            } else {
                await client.query('UPDATE notifications SET is_read = TRUE WHERE recipient_resource_id = $1', [resourceId]);
            }
            return res.status(200).json({ success: true });
        }

        if (method === 'GET') {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10000;
            const search = req.query.search as string || '';
            const offset = (page - 1) * limit;

            let queryStr = `SELECT * FROM ${tableName}`;
            const params: any[] = [];
            const whereClauses: string[] = [];

            if (id) {
                whereClauses.push(`id = $${params.length + 1}`);
                params.push(id);
            } else if (entity === 'notifications') {
                if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
                whereClauses.push(`recipient_resource_id = (SELECT resource_id FROM app_users WHERE id = $${params.length + 1})`);
                params.push(currentUser.id);
            } else if (search && (tableName === 'resources' || tableName === 'projects')) {
                whereClauses.push(`name ILIKE $${params.length + 1}`);
                params.push(`%${search}%`);
            }

            if (whereClauses.length > 0) queryStr += ` WHERE ${whereClauses.join(' AND ')}`;
            
            let totalCount = 0;
            if (req.query.limit) {
                const countRes = await client.query(`SELECT COUNT(*) FROM ${tableName} ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}`, params);
                totalCount = parseInt(countRes.rows[0].count, 10);
            }

            queryStr += entity === 'notifications' ? ' ORDER BY created_at DESC' : ' ORDER BY id ASC';
            if (req.query.limit) {
                queryStr += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                params.push(limit, offset);
            }

            const { rows } = await client.query(queryStr, params);
            const data = rows.map(toCamelAndNormalize);
            return res.status(200).json(req.query.limit ? { data, total: totalCount } : data);
        }

        if (method === 'POST') {
            const isSelfLeaveRequest = tableName === 'leave_requests' && req.body.resourceId === currentUser?.resourceId;
            const isOperational = currentUser && OPERATIONAL_ROLES.includes(currentUser.role);
            
            if (!currentUser || (!isOperational && !isSelfLeaveRequest)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const schema = VALIDATION_SCHEMAS[tableName as string];
            if (!schema) return res.status(400).json({ error: 'Unsupported entity' });
            const validated = schema.parse(req.body);

            // Safety: Force status to PENDING for non-operational users requesting leave
            if (tableName === 'leave_requests' && !isOperational) {
                validated.status = 'PENDING';
            }

            const newId = uuidv4();
            const cols = Object.keys(validated).map(k => k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`));
            const vals = Object.values(validated);
            const placeholders = vals.map((_, i) => `$${i + 2}`);
            await client.query(`INSERT INTO ${tableName} (id, ${cols.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`, [newId, ...vals]);
            await triggerNotification(client, 'POST', tableName as string, newId, validated);
            return res.status(201).json({ id: newId, ...validated });
        }

        if (method === 'PUT') {
            const isSelfLeaveRequest = tableName === 'leave_requests' && req.body.resourceId === currentUser?.resourceId;
            const isOperational = currentUser && OPERATIONAL_ROLES.includes(currentUser.role);

            if (!currentUser || (!isOperational && !isSelfLeaveRequest)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const oldData = (await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id])).rows[0];
            if (!oldData) return res.status(404).json({ error: 'Not found' });

            // Safety: Prevent non-operational users from changing status or other sensitive fields in leave requests
            if (tableName === 'leave_requests' && !isOperational) {
                if (req.body.status && req.body.status !== oldData.status && oldData.status !== 'PENDING') {
                     return res.status(403).json({ error: 'Cannot modify non-pending leave request' });
                }
            }

            const updates = Object.entries(req.body).filter(([k]) => k !== 'id' && k !== 'version').map(([k, v], i) => `${k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = $${i + 1}`);
            const vals = Object.entries(req.body).filter(([k]) => k !== 'id' && k !== 'version').map(([_, v]) => v);
            await client.query(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${vals.length + 1}`, [...vals, id]);
            await triggerNotification(client, 'PUT', tableName as string, id as string, req.body, oldData);
            return res.status(200).json({ id, ...req.body });
        }

        if (method === 'DELETE') {
            const oldData = (await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id])).rows[0];
            if (!oldData) return res.status(404).json({ error: 'Not found' });

            const isSelfLeaveRequest = tableName === 'leave_requests' && oldData.resource_id === currentUser?.resourceId;
            const isOperational = currentUser && OPERATIONAL_ROLES.includes(currentUser.role);

            if (!currentUser || (!isOperational && !isSelfLeaveRequest)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
            return res.status(204).end();
        }

        return res.status(405).end();
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: (e as Error).message });
    } finally {
        client.release();
    }
}
