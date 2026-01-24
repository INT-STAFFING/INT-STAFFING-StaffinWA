
// ... keep existing imports ...
import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

const isHolidayInternal = (date: Date, resourceLocation: string | null, companyCalendar: any[]): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return companyCalendar.some(event => {
        if (event.date !== dateStr) return false;
        if (event.type === 'NATIONAL_HOLIDAY' || event.type === 'COMPANY_CLOSURE') return true;
        if (event.type === 'LOCAL_HOLIDAY' && event.location === resourceLocation) return true;
        return false;
    });
};

export const performFullRecalculation = async (client: any) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const resourcesRes = await client.query('SELECT * FROM resources WHERE resigned = FALSE');
    const projectsRes = await client.query('SELECT * FROM projects');
    const assignmentsRes = await client.query('SELECT * FROM assignments');
    const allocationsRes = await client.query('SELECT * FROM allocations');
    const calendarRes = await client.query('SELECT * FROM company_calendar');
    const rolesRes = await client.query('SELECT * FROM roles');
    const historyRes = await client.query('SELECT * FROM role_cost_history');

    const resources = resourcesRes.rows;
    const projects = projectsRes.rows;
    const assignments = assignmentsRes.rows;
    const allocations = allocationsRes.rows;
    const calendar = calendarRes.rows.map((e: any) => ({ ...e, date: e.date.toISOString().split('T')[0] }));
    const roles = rolesRes.rows;
    const history = historyRes.rows;

    const getRate = (roleId: string, date: Date) => {
        const dStr = date.toISOString().split('T')[0];
        const h = history.find((r: any) => r.role_id === roleId && dStr >= r.start_date.toISOString().split('T')[0] && (!r.end_date || dStr <= r.end_date.toISOString().split('T')[0]));
        if (h) return Number(h.daily_cost);
        const r = roles.find((role: any) => role.id === roleId);
        return r ? Number(r.daily_cost) : 0;
    };

    let totalCost = 0;
    let totalDays = 0;
    const clientCost: Record<string, number> = {};
    const allocMap = new Map();
    allocations.forEach((a: any) => {
        const key = `${a.assignment_id}_${a.allocation_date.toISOString().split('T')[0]}`;
        allocMap.set(key, a.percentage);
    });

    for (const assignment of assignments) {
        const res = resources.find((r: any) => r.id === assignment.resource_id);
        const proj = projects.find((p: any) => p.id === assignment.project_id);
        if (!res || !proj) continue;
        let cur = new Date(startOfMonth);
        while (cur <= endOfMonth) {
            const dStr = cur.toISOString().split('T')[0];
            const pct = allocMap.get(`${assignment.id}_${dStr}`);
            if (pct && !isHolidayInternal(cur, res.location, calendar) && cur.getDay() !== 0 && cur.getDay() !== 6) {
                const fraction = pct / 100;
                const cost = fraction * getRate(res.role_id, cur) * (proj.realization_percentage / 100);
                totalCost += cost;
                totalDays += fraction;
                if (proj.client_id) clientCost[proj.client_id] = (clientCost[proj.client_id] || 0) + cost;
            }
            cur.setDate(cur.getDate() + 1);
        }
    }

    const assignedResIds = new Set(assignments.map((a: any) => a.resource_id));
    const staffedProjIds = new Set(assignments.map((a: any) => a.project_id));
    const kpiData = {
        totalBudget: projects.reduce((sum: number, p: any) => p.status === 'In corso' ? sum + Number(p.budget || 0) : sum, 0),
        totalCost,
        totalPersonDays: totalDays,
        totalActiveResources: resources.length,
        totalActiveProjects: projects.filter((p: any) => p.status === 'In corso').length,
        unassignedResources: resources.filter((r: any) => !assignedResIds.has(r.id)).map((r: any) => ({ id: r.id, name: r.name })),
        unstaffedProjects: projects.filter((p: any) => p.status === 'In corso' && !staffedProjIds.has(p.id)).map((p: any) => ({ id: p.id, name: p.name })),
        clientCostDistribution: clientCost,
        lastCalc: new Date().toISOString()
    };
    await client.query(`INSERT INTO analytics_cache (key, data, scope, updated_at) VALUES ('dashboard_kpi_current', $1, 'GLOBAL', NOW()) ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()`, [JSON.stringify(kpiData)]);
    return kpiData;
};

// Mappatura per entità i cui nomi frontend differiscono da quelli DB
const TABLE_MAPPING: Record<string, string> = {
    'leaves': 'leave_requests',
    'leave_types': 'leave_types',
    'role-permissions': 'role_permissions',
    'security-users': 'app_users',
    'rate_cards': 'rate_cards',
    'rate_card_entries': 'rate_card_entries',
    'project_expenses': 'project_expenses'
};

// Helper per convertire snake_case a camelCase e normalizzare le date
const toCamelAndNormalize = (o: any) => {
    if (!o) return {};
    const n: any = {};
    for (const k in o) {
        const camelKey = k.replace(/(_\w)/g, m => m[1].toUpperCase());
        let value = o[k];
        // Normalizza le colonne data in stringhe YYYY-MM-DD
        if (value instanceof Date && 
           (camelKey.endsWith('Date') || camelKey === 'date' || camelKey === 'lastDayOfWork')) {
            value = value.toISOString().split('T')[0];
        }
        n[camelKey] = value;
    }
    return n;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action, olderThanDays } = req.query;
    const client = await db.connect();
    const currentUser = getUserFromRequest(req);

    try {
        if (method === 'GET') {
            const sensitiveEntities = ['app-users', 'role-permissions', 'audit_logs', 'db_inspector', 'theme', 'security-users'];
            if (sensitiveEntities.includes(entity as string)) {
                if (!verifyAdmin(req)) {
                    return res.status(403).json({ error: 'Forbidden: Admin access required for this entity.' });
                }
            }
        }
        
        // --- GESTIONE BULK PERMISSIONS (Security Center) ---
        if ((entity === 'role-permissions' || entity === 'role_permissions') && method === 'POST' && req.body.permissions && Array.isArray(req.body.permissions)) {
             if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
             const { permissions } = req.body;
             await client.query('BEGIN');
             for (const p of permissions) {
                 await client.query(
                     `INSERT INTO role_permissions (role, page_path, is_allowed) 
                      VALUES ($1, $2, $3) 
                      ON CONFLICT (role, page_path) 
                      DO UPDATE SET is_allowed = $3`,
                     [p.role, p.pagePath, p.allowed]
                 );
             }
             await logAction(client, currentUser, 'UPDATE_RBAC_MATRIX', 'role_permissions', null, { count: permissions.length }, req);
             await client.query('COMMIT');
             return res.status(200).json({ success: true });
        }

        if (entity === 'roles' && method === 'PUT') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            const { name, seniorityLevel, dailyCost, standardCost } = req.body;
            await client.query('BEGIN');
            const roleCheck = await client.query('SELECT daily_cost FROM roles WHERE id = $1', [id]);
            const oldCost = roleCheck.rows[0]?.daily_cost;
            await client.query('UPDATE roles SET name=$1, seniority_level=$2, daily_cost=$3, standard_cost=$4, daily_expenses=$5 WHERE id=$6', [name, seniorityLevel, dailyCost, standardCost, Number(dailyCost) * 0.035, id]);
            if (Number(oldCost) !== Number(dailyCost)) {
                await client.query('UPDATE role_cost_history SET end_date = CURRENT_DATE WHERE role_id = $1 AND end_date IS NULL', [id]);
                await client.query('INSERT INTO role_cost_history (id, role_id, daily_cost, start_date) VALUES ($1, $2, $3, CURRENT_DATE)', [uuidv4(), id, dailyCost]);
            }
            await logAction(client, currentUser, 'UPDATE_ROLE', 'roles', id as string, req.body, req);
            await client.query('COMMIT');
            return res.status(200).json({ success: true });
        }
        
        // --- RATE CARD ENTRIES BATCH UPDATE ---
        if (entity === 'rate_card_entries' && method === 'POST' && req.body.entries && Array.isArray(req.body.entries)) {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            const { entries } = req.body;
            await client.query('BEGIN');
            // Assuming rateCardId is same for all in batch or provided individually
            // Clean out old entries for this card? No, simple UPSERT
            for (const entry of entries) {
                await client.query(
                    `INSERT INTO rate_card_entries (rate_card_id, role_id, daily_rate)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (rate_card_id, role_id)
                     DO UPDATE SET daily_rate = $3`,
                    [entry.rateCardId, entry.roleId, entry.dailyRate]
                );
            }
            await logAction(client, currentUser, 'UPSERT_RATE_CARD_ENTRIES', 'rate_card_entries', null, { count: entries.length }, req);
            await client.query('COMMIT');
            return res.status(200).json({ success: true });
        }

        if (entity === 'skills') {
            if (method === 'POST') {
                const { name, isCertification, categoryIds } = req.body;
                const newId = uuidv4();
                await client.query('BEGIN');
                await client.query(`INSERT INTO skills (id, name, is_certification) VALUES ($1, $2, $3)`, [newId, name, isCertification || false]);
                if (Array.isArray(categoryIds)) {
                    for (const catId of categoryIds) await client.query(`INSERT INTO skill_skill_category_map (skill_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [newId, catId]);
                }
                await client.query('COMMIT');
                await logAction(client, currentUser, 'CREATE_SKILL', 'skills', newId, { name, categoryIds }, req);
                return res.status(201).json({ id: newId, name, isCertification, categoryIds: categoryIds || [] });
            }
            if (method === 'PUT') {
                const { name, isCertification, categoryIds } = req.body;
                await client.query('BEGIN');
                await client.query(`UPDATE skills SET name = $1, is_certification = $2 WHERE id = $3`, [name, isCertification || false, id]);
                if (categoryIds !== undefined) {
                    await client.query(`DELETE FROM skill_skill_category_map WHERE skill_id = $1`, [id]);
                    if (Array.isArray(categoryIds)) {
                        for (const catId of categoryIds) await client.query(`INSERT INTO skill_skill_category_map (skill_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, catId]);
                    }
                }
                await client.query('COMMIT');
                await logAction(client, currentUser, 'UPDATE_SKILL', 'skills', id as string, req.body, req);
                return res.status(200).json({ id, ...req.body });
            }
        }

        if (entity === 'skill_categories') {
            if (method === 'POST') {
                const { name, macroCategoryIds } = req.body;
                const newId = uuidv4();
                await client.query('BEGIN');
                await client.query(`INSERT INTO skill_categories (id, name) VALUES ($1, $2)`, [newId, name]);
                if (Array.isArray(macroCategoryIds)) {
                    for (const mId of macroCategoryIds) await client.query(`INSERT INTO skill_category_macro_map (category_id, macro_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [newId, mId]);
                }
                await client.query('COMMIT');
                return res.status(201).json({ id: newId, name, macroCategoryIds: macroCategoryIds || [] });
            }
            if (method === 'PUT') {
                const { name, macroCategoryIds } = req.body;
                await client.query('BEGIN');
                await client.query(`UPDATE skill_categories SET name = $1 WHERE id = $2`, [name, id]);
                if (macroCategoryIds !== undefined) {
                    await client.query(`DELETE FROM skill_category_macro_map WHERE category_id = $1`, [id]);
                    if (Array.isArray(macroCategoryIds)) {
                        for (const mId of macroCategoryIds) await client.query(`INSERT INTO skill_category_macro_map (category_id, macro_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, mId]);
                    }
                }
                await client.query('COMMIT');
                return res.status(200).json({ id, ...req.body });
            }
        }

        if (entity === 'analytics_cache') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            if (method === 'POST' && action === 'recalc_all') {
                const result = await performFullRecalculation(client);
                await logAction(client, currentUser, 'RECALC_ANALYTICS', 'analytics_cache', null, { triggeredBy: currentUser.username }, req);
                return res.status(200).json({ success: true, data: result });
            }
        }

        if (entity === 'app-config-batch' && method === 'POST') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
            const { updates } = req.body;
            await client.query('BEGIN');
            for (const { key, value } of updates) await client.query(`INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [key, value]);
            await client.query('COMMIT');
            return res.status(200).json({ success: true });
        }

        if (entity === 'theme') {
            if (method === 'GET') return res.status(200).json((await client.query("SELECT key, value FROM app_config WHERE key LIKE 'theme.%'")).rows);
            if (method === 'POST') {
                if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
                const { updates } = req.body;
                await client.query('BEGIN');
                for (const [key, value] of Object.entries(updates)) {
                    await client.query(`INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, [key, value]);
                }
                // Force Enable and Bump Version
                await client.query(`INSERT INTO app_config (key, value) VALUES ('theme.db.enabled', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'`);
                await client.query(`INSERT INTO app_config (key, value) VALUES ('theme.version', (COALESCE((SELECT value::int FROM app_config WHERE key = 'theme.version'), 0) + 1)::text) ON CONFLICT (key) DO UPDATE SET value = (app_config.value::int + 1)::text`);
                
                await logAction(client, currentUser, 'UPDATE_THEME', 'theme', null, updates, req);
                await client.query('COMMIT');
                return res.status(200).json({ success: true });
            }
        }

        if (entity === 'audit_logs') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
            if (method === 'GET') {
                const { limit = 1000, username, actionType, startDate, endDate } = req.query;
                let q = `SELECT * FROM action_logs`, p = [], c = [];
                if (username) { c.push(`username ILIKE $${p.length + 1}`); p.push(`%${username}%`); }
                if (actionType) { c.push(`action = $${p.length + 1}`); p.push(actionType); }
                if (startDate) { c.push(`created_at >= $${p.length + 1}`); p.push(startDate); }
                if (endDate) { c.push(`created_at <= $${p.length + 1}`); p.push(endDate); }
                if (c.length) q += ` WHERE ${c.join(' AND ')}`;
                q += ` ORDER BY created_at DESC LIMIT $${p.length + 1}`;
                p.push(limit);
                const { rows } = await client.query(q, p);
                return res.status(200).json(rows.map(r => ({ id: r.id, userId: r.user_id, username: r.username, action: r.action, entity: r.entity, entity_id: r.entity_id, details: r.details, ipAddress: r.ip_address, createdAt: r.created_at })));
            }
            if (method === 'DELETE' && action === 'cleanup') {
                const days = parseInt(olderThanDays as string, 10);
                let q = olderThanDays === 'all' ? 'DELETE FROM action_logs' : 'DELETE FROM action_logs WHERE created_at < NOW() - INTERVAL \'1 day\' * $1';
                const result = await client.query(q, olderThanDays === 'all' ? [] : [days]);
                await logAction(client, currentUser, 'CLEANUP_LOGS', 'audit_logs', null, { count: result.rowCount }, req);
                return res.status(200).json({ success: true, deletedCount: result.rowCount });
            }
        }

        if (entity === 'notifications') {
            if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
            const userRes = await client.query('SELECT role, resource_id FROM app_users WHERE id = $1', [currentUser.id]);
            const user = userRes.rows[0];
            if (method === 'GET') {
                let q = 'SELECT * FROM notifications', p = [];
                if (user.role !== 'ADMIN') { if (!user.resource_id) return res.status(200).json([]); q += ' WHERE recipient_resource_id = $1'; p.push(user.resource_id); }
                q += ' ORDER BY created_at DESC';
                return res.status(200).json((await client.query(q, p)).rows.map(r => ({ id: r.id, recipientResourceId: r.recipient_resource_id, title: r.title, message: r.message, link: r.link, isRead: r.is_read, createdAt: r.created_at })));
            }
            if (method === 'PUT' && action === 'mark_read') {
                if (id) await client.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
                else if (user.resource_id) await client.query('UPDATE notifications SET is_read = TRUE WHERE recipient_resource_id = $1', [user.resource_id]);
                return res.status(200).json({ success: true });
            }
        }

        if (entity === 'app-users' || entity === 'security-users') {
            const tableName = 'app_users';
            
            if (action === 'impersonate' && method === 'POST') {
                if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
                
                const targetUserId = req.query.id as string;
                if (!targetUserId) return res.status(400).json({ error: 'Missing target user ID' });
                
                // Fetch target user details
                const { rows } = await client.query(`SELECT id, username, role, resource_id FROM ${tableName} WHERE id = $1`, [targetUserId]);
                const targetUser = rows[0];
                
                if (!targetUser) return res.status(404).json({ error: 'User not found' });
                
                // Generate token as if user logged in
                const token = jwt.sign(
                    { userId: targetUser.id, username: targetUser.username, role: targetUser.role },
                    JWT_SECRET!,
                    { expiresIn: '4h' } // Shorter expiry for impersonation
                );
                
                // Get permissions for the target user
                const permRes = await client.query(`SELECT page_path FROM role_permissions WHERE role = $1 AND is_allowed = TRUE`, [targetUser.role]);
                const permissions = permRes.rows.map(r => r.page_path);

                await logAction(client, currentUser, 'IMPERSONATE_USER', tableName, targetUserId, { target: targetUser.username }, req);

                return res.status(200).json({
                    success: true,
                    token,
                    user: {
                        id: targetUser.id,
                        username: targetUser.username,
                        role: targetUser.role,
                        resourceId: targetUser.resource_id,
                        permissions,
                        mustChangePassword: false // Skip pw change check during impersonation
                    },
                    isAdmin: targetUser.role === 'ADMIN'
                });
            }

            if (action === 'change_password' && method === 'PUT') {
                if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
                if (!verifyAdmin(req) && currentUser.id !== id) return res.status(403).json({ error: 'Forbidden' });
                const hash = await bcrypt.hash(req.body.newPassword, 10);
                await client.query(`UPDATE ${tableName} SET password_hash = $1, must_change_password = FALSE WHERE id = $2`, [hash, id]);
                await logAction(client, currentUser, 'CHANGE_PASSWORD', tableName, id as string, { targetUser: id }, req);
                return res.status(200).json({ success: true });
            }
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
            if (action === 'bulk_status_update' && method === 'PUT') {
                const updateResult = await client.query(`UPDATE ${tableName} SET is_active = $1 WHERE role = $2 AND username != 'admin'`, [req.body.isActive, req.body.role]);
                await logAction(client, currentUser, 'BULK_UPDATE_USER_STATUS', tableName, null, req.body, req);
                return res.status(200).json({ success: true, updatedCount: updateResult.rowCount });
            }
            if (action === 'bulk_password_reset' && method === 'POST') {
                await client.query('BEGIN');
                let s = 0;
                for (const u of req.body.users) {
                    try {
                        const h = await bcrypt.hash(u.password, 10);
                        const r = await client.query(`UPDATE ${tableName} SET password_hash = $1, must_change_password = TRUE WHERE username = $2 AND username != 'admin'`, [h, u.username]);
                        if (r.rowCount > 0) s++;
                    } catch (e) {}
                }
                await client.query('COMMIT');
                return res.status(200).json({ success: true, successCount: s });
            }
            if (method === 'GET') return res.status(200).json((await client.query(`SELECT u.id, u.username, u.role, u.is_active, u.resource_id, u.must_change_password, r.name as "resourceName" FROM ${tableName} u LEFT JOIN resources r ON u.resource_id = r.id ORDER BY u.username`)).rows.map(r => ({ ...r, isActive: r.is_active, resourceId: r.resource_id, mustChangePassword: r.must_change_password })));
            if (method === 'POST') {
                const { username, password, role, isActive, resourceId, mustChangePassword } = req.body;
                const h = await bcrypt.hash(password || "Staffing2024!", 10); const newId = uuidv4();
                await client.query(`INSERT INTO ${tableName} (id, username, password_hash, role, is_active, resource_id, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [newId, username, h, role, isActive, resourceId || null, mustChangePassword || false]);
                return res.status(201).json({ id: newId, username, role, isActive, resourceId, mustChangePassword });
            }
            if (method === 'PUT') {
                const { username, role, isActive, resourceId, mustChangePassword } = req.body;
                await client.query(`UPDATE ${tableName} SET username=$1, role=$2, is_active=$3, resource_id=$4, must_change_password=$5 WHERE id=$6`, [username, role, isActive, resourceId || null, mustChangePassword || false, id]);
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') { await client.query(`DELETE FROM ${tableName} WHERE id=$1`, [id]); return res.status(204).end(); }
        }

        const validTables = ['resources', 'projects', 'clients', 'company_calendar', 'interviews', 'contracts', 'resource_skills', 'project_skills', 'skill_macro_categories', 'leaves', 'leave_types', 'role_permissions', 'contract_projects', 'contract_managers', 'roles', 'skills', 'skill_categories', 'rate_cards', 'rate_card_entries', 'project_expenses'];
        if (validTables.includes(entity as string) || TABLE_MAPPING[entity as string]) {
            const writeMethods = ['POST', 'PUT', 'DELETE'];
            
            // Check Permissions
            if (writeMethods.includes(method)) {
                if (!currentUser) return res.status(403).json({ error: 'Unauthorized' });
                
                const isOperational = OPERATIONAL_ROLES.includes(currentUser.role);
                // Allow 'SIMPLE' role (or any authenticated user) to manage leaves, consistent with typical self-service usage.
                // Stricter logic can be applied if needed (e.g. only own leaves), but basic access is required here.
                const isLeaves = entity === 'leaves' || entity === 'leave_requests';
                
                if (!isOperational && !isLeaves) {
                     return res.status(403).json({ error: 'Unauthorized' });
                }
            }
            
            // Determina il nome effettivo della tabella nel database
            const tableName = TABLE_MAPPING[entity as string] || (entity as string);

            if (method === 'GET') {
                if (id) {
                     const { rows } = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
                     return res.status(200).json(rows[0] ? toCamelAndNormalize(rows[0]) : null);
                } else {
                     const { rows } = await client.query(`SELECT * FROM ${tableName}`);
                     
                     // SPECIAL HANDLING FOR ROLE PERMISSIONS
                     if (tableName === 'role_permissions') {
                        // Manual mapping to match RolePermission interface
                        return res.status(200).json(rows.map(r => ({
                            role: r.role,
                            pagePath: r.page_path,
                            allowed: r.is_allowed
                        })));
                     }

                     return res.status(200).json(rows.map(toCamelAndNormalize));
                }
            }

            if (method === 'POST') {
                const keys = Object.keys(req.body); const values = Object.values(req.body);
                const toSnake = (s: string) => s.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
                const dbKeys = keys.map(toSnake);
                
                // Gestione tabelle associative con chiavi composte
                const compositeKeyTables: Record<string, string> = {
                    'resource_skills': '(resource_id, skill_id)',
                    'project_skills': '(project_id, skill_id)',
                    'role_permissions': '(role, page_path)',
                    'contract_projects': '(contract_id, project_id)',
                    'contract_managers': '(contract_id, resource_id)',
                    'rate_card_entries': '(rate_card_id, role_id)'
                };

                if (compositeKeyTables[tableName]) {
                    const ct = compositeKeyTables[tableName];
                    const ph = values.map((_, i) => `$${i + 1}`).join(',');
                    const uc = dbKeys.filter(k => !ct.includes(k)).map(k => `${k} = EXCLUDED.${k}`).join(', ');
                    let q = `INSERT INTO ${tableName} (${dbKeys.join(',')}) VALUES (${ph})`;
                    q += uc.length > 0 ? ` ON CONFLICT ${ct} DO UPDATE SET ${uc}` : ` ON CONFLICT ${ct} DO NOTHING`;
                    const { rows } = await client.query(q + ' RETURNING *', values);
                    await logAction(client, currentUser, `UPSERT_${tableName.toUpperCase()}`, tableName, null, req.body, req);
                    return res.status(201).json(rows[0] ? toCamelAndNormalize(rows[0]) : {});
                }
                
                if (!keys.includes('id')) { 
                    keys.push('id'); 
                    dbKeys.push('id'); 
                    values.push(uuidv4()); 
                }
                
                const { rows } = await client.query(`INSERT INTO ${tableName} (${dbKeys.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, values);
                await logAction(client, currentUser, `CREATE_${tableName.toUpperCase()}`, tableName, rows[0]?.id, req.body, req);
                return res.status(201).json(toCamelAndNormalize(rows[0]));
            }
            if (method === 'PUT' && id) {
                const setClauses = []; const values = []; let idx = 1;
                for (const [k, v] of Object.entries(req.body)) { if (k === 'id') continue; setClauses.push(`${k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = $${idx++}`); values.push(v); }
                if (setClauses.length === 0) return res.status(200).json(req.body);
                values.push(id);
                const { rows } = await client.query(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`, values);
                await logAction(client, currentUser, `UPDATE_${tableName.toUpperCase()}`, tableName, id as string, req.body, req);
                return res.status(200).json(toCamelAndNormalize(rows[0]));
            }
            if (method === 'DELETE') {
                if (id) await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
                else if (tableName === 'resource_skills') await client.query(`DELETE FROM resource_skills WHERE resource_id = $1 AND skill_id = $2`, [req.query.resourceId, req.query.skillId]);
                else if (tableName === 'project_skills') await client.query(`DELETE FROM project_skills WHERE project_id = $1 AND skill_id = $2`, [req.query.projectId, req.query.skillId]);
                else if (tableName === 'contract_projects') await client.query(`DELETE FROM contract_projects WHERE contract_id = $1 AND project_id = $2`, [req.query.contractId, req.query.projectId]);
                else if (tableName === 'contract_managers') await client.query(`DELETE FROM contract_managers WHERE contract_id = $1 AND resource_id = $2`, [req.query.contractId, req.query.resourceId]);
                await logAction(client, currentUser, `DELETE_${tableName.toUpperCase()}`, tableName, id as string, {}, req);
                return res.status(204).end();
            }
        }

        return res.status(400).json({ error: 'Unknown entity or method' });
    } catch (error) { return res.status(500).json({ error: (error as Error).message }); } finally { client.release(); }
}
