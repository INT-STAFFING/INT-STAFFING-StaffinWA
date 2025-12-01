
import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'staffing-app-secret-key-change-in-prod';

// Helper to verify JWT for admin actions
const verifyAdmin = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    
    const token = authHeader.split(' ')[1];
    if (!token) return false;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return decoded.role === 'ADMIN';
    } catch (e) {
        return false;
    }
};

const getUserFromRequest = (req: VercelRequest) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    
    const token = authHeader.split(' ')[1];
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return {
            id: decoded.userId,
            username: decoded.username,
            role: decoded.role,
        };
    } catch (e) {
        return null;
    }
};

// --- AUDIT LOG UTILITY ---
const logAction = async (client: any, user: any, action: string, entity: string, entityId: string | null, details: any, req: VercelRequest) => {
    try {
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
        await client.query(
            `INSERT INTO action_logs (user_id, username, action, entity, entity_id, details, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [user?.id || null, user?.username || 'system', action, entity, entityId, JSON.stringify(details), ip]
        );
    } catch (e) {
        console.error("Failed to write audit log:", e);
        // Don't throw, logging should not break main flow
    }
};

// --- DATE UTILS (Internal copy to avoid import issues) ---
const isHolidayInternal = (date: Date, resourceLocation: string | null, companyCalendar: any[]): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return companyCalendar.some(event => {
        if (event.date !== dateStr) return false;
        if (event.type === 'NATIONAL_HOLIDAY' || event.type === 'COMPANY_CLOSURE') return true;
        if (event.type === 'LOCAL_HOLIDAY' && event.location === resourceLocation) return true;
        return false;
    });
};

// --- ANALYTICS RECALCULATION LOGIC ---
export const performFullRecalculation = async (client: any) => {
    // 1. Fetch raw data
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

    // Helper to get daily rate
    const getRate = (roleId: string, date: Date) => {
        const dStr = date.toISOString().split('T')[0];
        const h = history.find((r: any) => r.role_id === roleId && dStr >= r.start_date.toISOString().split('T')[0] && (!r.end_date || dStr <= r.end_date.toISOString().split('T')[0]));
        if (h) return Number(h.daily_cost);
        const r = roles.find((role: any) => role.id === roleId);
        return r ? Number(r.daily_cost) : 0;
    };

    // --- KPI 1: Current Month Costs & Days ---
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
                const rate = getRate(res.role_id, cur);
                const cost = fraction * rate * (proj.realization_percentage / 100);
                
                totalCost += cost;
                totalDays += fraction;
                
                if (proj.client_id) {
                    clientCost[proj.client_id] = (clientCost[proj.client_id] || 0) + cost;
                }
            }
            cur.setDate(cur.getDate() + 1);
        }
    }

    // --- KPI 2: Unallocated ---
    const assignedResIds = new Set(assignments.map((a: any) => a.resource_id));
    const unassignedCount = resources.filter((r: any) => !assignedResIds.has(r.id)).length;
    
    // --- KPI 3: Unstaffed Projects ---
    const staffedProjIds = new Set(assignments.map((a: any) => a.project_id));
    const unstaffedCount = projects.filter((p: any) => p.status === 'In corso' && !staffedProjIds.has(p.id)).length;

    // --- KPI 4: Total Active Budget ---
    const totalBudget = projects.reduce((sum: number, p: any) => {
        if (p.status === 'In corso') {
            return sum + Number(p.budget || 0);
        }
        return sum;
    }, 0);

    // --- Save to Cache ---
    const kpiData = {
        totalBudget,
        totalCost,
        totalPersonDays: totalDays,
        totalActiveResources: resources.length,
        totalActiveProjects: projects.filter((p: any) => p.status === 'In corso').length,
        unassignedResources: resources.filter((r: any) => !assignedResIds.has(r.id)).map((r: any) => ({ id: r.id, name: r.name })),
        unstaffedProjects: projects.filter((p: any) => p.status === 'In corso' && !staffedProjIds.has(p.id)).map((p: any) => ({ id: p.id, name: p.name })),
        clientCostDistribution: clientCost,
        lastCalc: new Date().toISOString()
    };

    await client.query(`
        INSERT INTO analytics_cache (key, data, scope, updated_at)
        VALUES ('dashboard_kpi_current', $1, 'GLOBAL', NOW())
        ON CONFLICT (key) DO UPDATE SET data = $1, updated_at = NOW()
    `, [JSON.stringify(kpiData)]);
    
    return kpiData;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action, table, dialect, olderThanDays } = req.query;
    const client = await db.connect();
    const currentUser = getUserFromRequest(req);

    try {
        // --- CUSTOM HANDLER FOR SKILLS (M:N Relations) ---
        if (entity === 'skills') {
            if (method === 'POST') {
                const { name, isCertification, categoryIds } = req.body;
                const newId = uuidv4();
                
                await client.query('BEGIN');
                await client.query(
                    `INSERT INTO skills (id, name, is_certification) VALUES ($1, $2, $3)`,
                    [newId, name, isCertification || false]
                );
                
                if (Array.isArray(categoryIds) && categoryIds.length > 0) {
                    for (const catId of categoryIds) {
                        await client.query(
                            `INSERT INTO skill_skill_category_map (skill_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                            [newId, catId]
                        );
                    }
                }
                await client.query('COMMIT');
                
                await logAction(client, currentUser, 'CREATE_SKILL', 'skills', newId, { name, categoryIds }, req);
                return res.status(201).json({ id: newId, name, isCertification, categoryIds: categoryIds || [] });
            }
            
            if (method === 'PUT') {
                const { name, isCertification, categoryIds } = req.body;
                
                await client.query('BEGIN');
                await client.query(
                    `UPDATE skills SET name = $1, is_certification = $2 WHERE id = $3`,
                    [name, isCertification || false, id]
                );
                
                // Sync Categories: Delete all then re-insert
                if (categoryIds !== undefined) {
                    await client.query(`DELETE FROM skill_skill_category_map WHERE skill_id = $1`, [id]);
                    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
                        for (const catId of categoryIds) {
                            await client.query(
                                `INSERT INTO skill_skill_category_map (skill_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                                [id, catId]
                            );
                        }
                    }
                }
                await client.query('COMMIT');
                
                await logAction(client, currentUser, 'UPDATE_SKILL', 'skills', id as string, req.body, req);
                return res.status(200).json({ id, ...req.body });
            }
        }

        // --- CUSTOM HANDLER FOR SKILL CATEGORIES (M:N with Macros) ---
        if (entity === 'skill_categories') {
            if (method === 'POST') {
                const { name, macroCategoryIds } = req.body;
                const newId = uuidv4();
                
                await client.query('BEGIN');
                await client.query(
                    `INSERT INTO skill_categories (id, name) VALUES ($1, $2)`,
                    [newId, name]
                );
                if (Array.isArray(macroCategoryIds) && macroCategoryIds.length > 0) {
                    for (const mId of macroCategoryIds) {
                        await client.query(
                            `INSERT INTO skill_category_macro_map (category_id, macro_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                            [newId, mId]
                        );
                    }
                }
                await client.query('COMMIT');
                return res.status(201).json({ id: newId, name, macroCategoryIds: macroCategoryIds || [] });
            }
            if (method === 'PUT') {
                const { name, macroCategoryIds } = req.body;
                await client.query('BEGIN');
                await client.query(
                    `UPDATE skill_categories SET name = $1 WHERE id = $2`,
                    [name, id]
                );
                if (macroCategoryIds !== undefined) {
                    await client.query(`DELETE FROM skill_category_macro_map WHERE category_id = $1`, [id]);
                    if (Array.isArray(macroCategoryIds) && macroCategoryIds.length > 0) {
                        for (const mId of macroCategoryIds) {
                            await client.query(
                                `INSERT INTO skill_category_macro_map (category_id, macro_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                                [id, mId]
                            );
                        }
                    }
                }
                await client.query('COMMIT');
                return res.status(200).json({ id, ...req.body });
            }
        }

        // --- ANALYTICS CACHE MANAGEMENT ---
        if (entity === 'analytics_cache') {
            // Allow roles: ADMIN, MANAGER, SENIOR MANAGER, MANAGING DIRECTOR
            const allowedRoles = ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];
            if (!currentUser || !allowedRoles.includes(currentUser.role)) {
                return res.status(403).json({ error: 'Insufficient permissions to trigger recalculation.' });
            }

            if (method === 'POST' && action === 'recalc_all') {
                const result = await performFullRecalculation(client);
                await logAction(client, currentUser, 'RECALC_ANALYTICS', 'analytics_cache', null, { triggeredBy: currentUser.username }, req);
                return res.status(200).json({ success: true, data: result });
            }
        }

        // --- CONFIG BATCH UPDATE ---
        if (entity === 'app-config-batch' && method === 'POST') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });

            const { updates } = req.body; // [{ key, value }]
            if (!Array.isArray(updates)) throw new Error('Invalid updates format');
            
            try {
                await client.query('BEGIN');
                for (const { key, value } of updates) {
                    await client.query(`
                        INSERT INTO app_config (key, value) VALUES ($1, $2)
                        ON CONFLICT (key) DO UPDATE SET value = $2
                    `, [key, value]);
                }
                await client.query('COMMIT');
                return res.status(200).json({ success: true });
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            }
        }

        // --- THEME HANDLER ---
        if (entity === 'theme') {
            if (method === 'GET') {
                const { rows } = await client.query("SELECT key, value FROM app_config WHERE key LIKE 'theme.%'");
                return res.status(200).json(rows);
            }
            if (method === 'POST') {
                const { updates } = req.body;
                await client.query('BEGIN');
                for (const [key, value] of Object.entries(updates)) {
                    await client.query(`
                        INSERT INTO app_config (key, value) VALUES ($1, $2)
                        ON CONFLICT (key) DO UPDATE SET value = $2
                    `, [key, value]);
                }
                await client.query('COMMIT');
                return res.status(200).json({ success: true });
            }
        }

        // --- AUDIT LOGS HANDLER ---
        if (entity === 'audit_logs') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });

            if (method === 'GET') {
                const { limit = 1000, username, actionType, startDate, endDate } = req.query;
                let query = `SELECT * FROM action_logs`;
                const params: any[] = [];
                const conditions: string[] = [];

                if (username) {
                    conditions.push(`username ILIKE $${params.length + 1}`);
                    params.push(`%${username}%`);
                }
                if (actionType) {
                    conditions.push(`action = $${params.length + 1}`);
                    params.push(actionType);
                }
                if (startDate) {
                    conditions.push(`created_at >= $${params.length + 1}`);
                    params.push(startDate);
                }
                if (endDate) {
                    conditions.push(`created_at <= $${params.length + 1}`);
                    params.push(endDate);
                }

                if (conditions.length > 0) {
                    query += ` WHERE ${conditions.join(' AND ')}`;
                }

                query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
                params.push(limit);

                const { rows } = await client.query(query, params);
                
                // Format for frontend
                const logs = rows.map(r => ({
                    id: r.id,
                    userId: r.user_id,
                    username: r.username,
                    action: r.action,
                    entity: r.entity,
                    entity_id: r.entity_id,
                    details: r.details,
                    ipAddress: r.ip_address,
                    createdAt: r.created_at
                }));

                return res.status(200).json(logs);
            }

            if (method === 'DELETE') {
                // Advanced Cleanup
                if (action === 'cleanup') {
                    const days = parseInt(olderThanDays as string, 10);
                    
                    if (isNaN(days) && olderThanDays !== 'all') {
                        return res.status(400).json({ error: 'Invalid olderThanDays parameter' });
                    }

                    let query = '';
                    let params: any[] = [];

                    if (olderThanDays === 'all') {
                        query = 'DELETE FROM action_logs';
                    } else {
                        query = 'DELETE FROM action_logs WHERE created_at < NOW() - INTERVAL \'1 day\' * $1';
                        params.push(days);
                    }

                    const result = await client.query(query, params);
                    
                    await logAction(client, currentUser, 'CLEANUP_LOGS', 'audit_logs', null, { deletedCount: result.rowCount, strategy: olderThanDays }, req);

                    return res.status(200).json({ success: true, deletedCount: result.rowCount });
                }
            }
        }

        // --- NOTIFICATIONS HANDLER ---
        if (entity === 'notifications') {
            const tokenUser = getUserFromRequest(req);
            if (!tokenUser) return res.status(401).json({ error: 'Unauthorized' });

            // Fetch full user details to get resource_id
            const userRes = await client.query('SELECT role, resource_id FROM app_users WHERE id = $1', [tokenUser.id]);
            const user = userRes.rows[0];
            if (!user) return res.status(401).json({ error: 'User not found' });

            if (method === 'GET') {
                let query = 'SELECT * FROM notifications';
                const params = [];
                
                if (user.role !== 'ADMIN') {
                    // If not admin, only show notifications for this resource
                    if (!user.resource_id) return res.status(200).json([]); // No resource linked, no notifications
                    query += ' WHERE recipient_resource_id = $1';
                    params.push(user.resource_id);
                }
                
                query += ' ORDER BY created_at DESC';
                const { rows } = await client.query(query, params);
                
                return res.status(200).json(rows.map(r => ({
                    id: r.id,
                    recipientResourceId: r.recipient_resource_id,
                    title: r.title,
                    message: r.message,
                    link: r.link,
                    isRead: r.is_read,
                    createdAt: r.created_at
                })));
            }

            if (method === 'PUT' && action === 'mark_read') {
                // Mark specific notification or all as read
                if (id) {
                    await client.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
                } else {
                    // Mark all for this user
                    if (user.resource_id) {
                        await client.query('UPDATE notifications SET is_read = TRUE WHERE recipient_resource_id = $1', [user.resource_id]);
                    }
                }
                return res.status(200).json({ success: true });
            }
        }

        // --- APP USERS & AUTH MANAGEMENT (PROTECTED) ---
        if (entity === 'app-users') {
            // Change Password (Self or Admin)
            if (action === 'change_password' && method === 'PUT') {
                // Verify user is authenticated
                const user = getUserFromRequest(req);
                if (!user) return res.status(401).json({ error: 'Unauthorized' });

                // Allow if admin OR if changing own password
                if (!verifyAdmin(req) && user.id !== id) {
                    return res.status(403).json({ error: 'Forbidden' });
                }

                const { newPassword } = req.body;
                const hash = await bcrypt.hash(newPassword, 10);
                
                // Reset the must_change_password flag upon successful change
                await client.query('UPDATE app_users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [hash, id]);
                
                await logAction(client, user, 'CHANGE_PASSWORD', 'app_users', id as string, { targetUser: id }, req);

                return res.status(200).json({ success: true });
            }

            // --- BELOW THIS POINT ONLY ADMIN ---
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
            
            // BULK STATUS UPDATE
            if (action === 'bulk_status_update' && method === 'PUT') {
                const { role, isActive } = req.body;
                
                if (!role) return res.status(400).json({ error: 'Role is required' });

                // Perform bulk update, ensuring 'admin' user is never disabled even if role matches
                const result = await client.query(
                    `UPDATE app_users SET is_active = $1 WHERE role = $2 AND username != 'admin'`,
                    [isActive, role]
                );

                await logAction(client, currentUser, 'BULK_UPDATE_USER_STATUS', 'app_users', null, { role, isActive, count: result.rowCount }, req);
                return res.status(200).json({ success: true, updatedCount: result.rowCount });
            }

            // BULK PASSWORD RESET
            if (action === 'bulk_password_reset' && method === 'POST') {
                const { users } = req.body; // Expects [{username, password}, ...]
                if (!Array.isArray(users) || users.length === 0) {
                    return res.status(400).json({ error: 'Invalid input format' });
                }

                await client.query('BEGIN');
                let successCount = 0;
                let failCount = 0;

                for (const user of users) {
                    if (!user.username || !user.password) continue;
                    
                    try {
                        const hash = await bcrypt.hash(user.password, 10);
                        // Also force password change on next login
                        const result = await client.query(
                            `UPDATE app_users 
                             SET password_hash = $1, must_change_password = TRUE 
                             WHERE username = $2 AND username != 'admin'`, 
                            [hash, user.username]
                        );
                        if (result.rowCount > 0) successCount++;
                        else failCount++;
                    } catch (e) {
                        failCount++;
                    }
                }
                
                await client.query('COMMIT');
                await logAction(client, currentUser, 'BULK_PASSWORD_RESET', 'app_users', null, { successCount, failCount }, req);
                
                return res.status(200).json({ success: true, successCount, failCount });
            }

            if (method === 'GET') {
                const { rows } = await client.query(`
                    SELECT u.id, u.username, u.role, u.is_active, u.resource_id, u.must_change_password, r.name as "resourceName"
                    FROM app_users u
                    LEFT JOIN resources r ON u.resource_id = r.id
                    ORDER BY u.username
                `);
                return res.status(200).json(rows.map(r => ({
                    ...r,
                    isActive: r.is_active, // Map snake_case to camelCase
                    resourceId: r.resource_id,
                    mustChangePassword: r.must_change_password
                })));
            }
            if (method === 'POST') {
                const { username, password, role, isActive, resourceId, mustChangePassword } = req.body;
                const hash = await bcrypt.hash(password, 10);
                const newId = uuidv4();
                await client.query(
                    'INSERT INTO app_users (id, username, password_hash, role, is_active, resource_id, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [newId, username, hash, role, isActive, resourceId || null, mustChangePassword || false]
                );
                await logAction(client, currentUser, 'CREATE_USER', 'app_users', newId, { username, role }, req);
                return res.status(201).json({ id: newId });
            }
            if (method === 'PUT') {
                const { username, role, isActive, resourceId, mustChangePassword } = req.body;
                await client.query(
                    'UPDATE app_users SET username=$1, role=$2, is_active=$3, resource_id=$4, must_change_password=$5 WHERE id=$6',
                    [username, role, isActive, resourceId || null, mustChangePassword || false, id]
                );
                await logAction(client, currentUser, 'UPDATE_USER', 'app_users', id as string, { username, role, isActive }, req);
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await client.query('DELETE FROM app_users WHERE id=$1', [id]);
                await logAction(client, currentUser, 'DELETE_USER', 'app_users', id as string, {}, req);
                return res.status(204).end();
            }
        }

        // --- ROLE PERMISSIONS (PROTECTED) ---
        if (entity === 'role-permissions') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });

            if (method === 'GET') {
                const { rows } = await client.query('SELECT * FROM role_permissions');
                return res.status(200).json(rows.map(r => ({
                    role: r.role,
                    pagePath: r.page_path,
                    allowed: r.is_allowed
                })));
            }
            if (method === 'POST') {
                const { permissions } = req.body; // Expects array of { role, pagePath, allowed }
                
                await client.query('BEGIN');
                
                for (const p of permissions) {
                    // Use UPSERT (Insert or Update) to be safe and efficient
                    await client.query(`
                        INSERT INTO role_permissions (role, page_path, is_allowed) 
                        VALUES ($1, $2, $3)
                        ON CONFLICT (role, page_path) 
                        DO UPDATE SET is_allowed = EXCLUDED.is_allowed;
                    `, [p.role, p.pagePath, p.allowed]);
                }
                
                await client.query('COMMIT');
                await logAction(client, currentUser, 'UPDATE_PERMISSIONS', 'role_permissions', null, { count: permissions.length }, req);

                // Return the FRESH state from DB to ensure frontend is in sync
                const { rows } = await client.query('SELECT * FROM role_permissions');
                const updatedPermissions = rows.map(r => ({
                    role: r.role,
                    pagePath: r.page_path,
                    allowed: r.is_allowed
                }));

                return res.status(200).json({ success: true, permissions: updatedPermissions });
            }
        }

        // --- LEAVE REQUESTS ---
        if (entity === 'leaves') {
            if (method === 'POST') {
                const { resourceId, typeId, startDate, endDate, status, managerId, approverIds, notes, isHalfDay } = req.body;
                const newId = uuidv4();
                // Convert array for postgres safely
                const approverIdsPg = approverIds && approverIds.length > 0 ? `{${approverIds.join(',')}}` : null;
                
                await client.query(`
                    INSERT INTO leave_requests (id, resource_id, type_id, start_date, end_date, status, manager_id, approver_ids, notes, is_half_day) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [newId, resourceId, typeId, startDate, endDate, status, managerId || null, approverIdsPg, notes, isHalfDay || false]);
                
                // --- TRIGGER NOTIFICATIONS FOR APPROVERS ---
                if (approverIds && approverIds.length > 0) {
                    const requestorRes = await client.query('SELECT name FROM resources WHERE id = $1', [resourceId]);
                    const requestorName = requestorRes.rows[0]?.name || 'Una risorsa';
                    
                    const notifTitle = "Nuova Richiesta Ferie";
                    const notifMsg = `${requestorName} ha inserito una nuova richiesta di assenza.`;
                    const notifLink = "/leaves";

                    for (const approverId of approverIds) {
                        const notifId = uuidv4();
                        await client.query(`
                            INSERT INTO notifications (id, recipient_resource_id, title, message, link)
                            VALUES ($1, $2, $3, $4, $5)
                        `, [notifId, approverId, notifTitle, notifMsg, notifLink]);
                    }
                }
                await logAction(client, currentUser, 'CREATE_LEAVE', 'leave_requests', newId, { resourceId, typeId, status }, req);
                return res.status(201).json({ id: newId, ...req.body });
            }
            if (method === 'PUT') {
                const { resourceId, typeId, startDate, endDate, status, managerId, approverIds, notes, isHalfDay } = req.body;
                
                // Get old status to check for changes
                const oldReqRes = await client.query('SELECT status, resource_id FROM leave_requests WHERE id = $1', [id]);
                const oldStatus = oldReqRes.rows[0]?.status;
                const requestOwnerId = oldReqRes.rows[0]?.resource_id;

                let query = 'UPDATE leave_requests SET ';
                const params = [];
                let idx = 1;
                
                if (resourceId) { query += `resource_id=$${idx++}, `; params.push(resourceId); }
                if (typeId) { query += `type_id=$${idx++}, `; params.push(typeId); }
                if (startDate) { query += `start_date=$${idx++}, `; params.push(startDate); }
                if (endDate) { query += `end_date=$${idx++}, `; params.push(endDate); }
                if (status) { query += `status=$${idx++}, `; params.push(status); }
                if (managerId !== undefined) { query += `manager_id=$${idx++}, `; params.push(managerId); }
                if (approverIds !== undefined) { 
                    query += `approver_ids=$${idx++}, `; 
                    const val = approverIds && approverIds.length > 0 ? `{${approverIds.join(',')}}` : null;
                    params.push(val); 
                }
                if (notes !== undefined) { query += `notes=$${idx++}, `; params.push(notes); }
                if (isHalfDay !== undefined) { query += `is_half_day=$${idx++}, `; params.push(isHalfDay); }
                
                query = query.slice(0, -2) + ` WHERE id=$${idx}`;
                params.push(id);
                
                await client.query(query, params);

                // --- TRIGGER NOTIFICATION FOR REQUESTOR ---
                if (status && status !== oldStatus && requestOwnerId) {
                    const notifTitle = "Aggiornamento Richiesta Ferie";
                    let notifMsg = `Lo stato della tua richiesta è cambiato in: ${status}.`;
                    if (status === 'APPROVED') notifMsg = "La tua richiesta di ferie è stata APPROVATA.";
                    if (status === 'REJECTED') notifMsg = "La tua richiesta di ferie è stata RIFIUTATA.";
                    
                    const notifId = uuidv4();
                    await client.query(`
                        INSERT INTO notifications (id, recipient_resource_id, title, message, link)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [notifId, requestOwnerId, notifTitle, notifMsg, "/leaves"]);
                }
                await logAction(client, currentUser, 'UPDATE_LEAVE', 'leave_requests', id as string, { status, oldStatus }, req);
                return res.status(200).json({ id, ...req.body });
            }
            if (method === 'DELETE') {
                await client.query('DELETE FROM leave_requests WHERE id=$1', [id]);
                await logAction(client, currentUser, 'DELETE_LEAVE', 'leave_requests', id as string, {}, req);
                return res.status(204).end();
            }
        }

        // --- LEAVE TYPES ---
        if (entity === 'leave_types') {
            if (method === 'POST') {
                const { name, color, requiresApproval, affectsCapacity } = req.body;
                const newId = uuidv4();
                await client.query(
                    'INSERT INTO leave_types (id, name, color, requires_approval, affects_capacity) VALUES ($1, $2, $3, $4, $5)',
                    [newId, name, color, requiresApproval, affectsCapacity]
                );
                return res.status(201).json({ id: newId, ...req.body });
            }
            if (method === 'PUT') {
                const { name, color, requiresApproval, affectsCapacity } = req.body;
                await client.query(
                    'UPDATE leave_types SET name=$1, color=$2, requires_approval=$3, affects_capacity=$4 WHERE id=$5',
                    [name, color, requiresApproval, affectsCapacity, id]
                );
                return res.status(200).json({ id, ...req.body });
            }
            if (method === 'DELETE') {
                await client.query('DELETE FROM leave_types WHERE id=$1', [id]);
                return res.status(204).end();
            }
        }

        // --- DB INSPECTOR (PROTECTED) ---
        if (entity === 'db_inspector') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });

            if (action === 'list_tables') {
                const { rows } = await client.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name;
                `);
                return res.status(200).json(rows.map(r => r.table_name));
            }
            if (action === 'get_table_data' && table) {
                const columnsRes = await client.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = $1 
                    ORDER BY ordinal_position;
                `, [table]);
                
                const dataRes = await client.query(`SELECT * FROM ${table} LIMIT 1000;`); // Limit for safety
                return res.status(200).json({ columns: columnsRes.rows, rows: dataRes.rows });
            }
            if (action === 'update_row' && table && id) {
                const updates = req.body;
                const setClauses = [];
                const values = [];
                let idx = 1;
                
                for (const [key, val] of Object.entries(updates)) {
                    setClauses.push(`${key} = $${idx}`);
                    values.push(val);
                    idx++;
                }
                values.push(id);
                
                await client.query(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
                await logAction(client, currentUser, 'DB_INSPECTOR_UPDATE', table as string, id as string, { updates }, req);
                return res.status(200).json({ success: true });
            }
            if (action === 'delete_all_rows' && table) {
                await client.query(`DELETE FROM ${table}`);
                await logAction(client, currentUser, 'DB_INSPECTOR_TRUNCATE', table as string, null, {}, req);
                return res.status(200).json({ success: true });
            }
            // NEW: Run Raw SQL
            if (action === 'run_raw_query' && method === 'POST') {
                const { query } = req.body;
                if (!query) return res.status(400).json({ error: 'Query is required' });
                
                try {
                    const result = await client.query(query);
                    await logAction(client, currentUser, 'DB_RAW_QUERY', 'sql', null, { query: query.substring(0, 200) }, req); // Log truncated query
                    return res.status(200).json({ 
                        success: true, 
                        rows: result.rows, 
                        fields: result.fields, 
                        rowCount: result.rowCount,
                        command: result.command 
                    });
                } catch(e) {
                    return res.status(400).json({ error: (e as Error).message });
                }
            }
            if (action === 'export_sql' && dialect) {
                return res.status(400).json({ error: 'Use /api/export-sql endpoint' });
            }
        }

        // --- GENERIC CRUD ---
        const validTables = [
            'resources', 'projects', 'clients', 'roles', 'company_calendar', 
            'interviews', 'contracts', 'resource_skills', 'project_skills',
            'skill_categories', 'skill_macro_categories' // Added generic access
        ];
        
        if (validTables.includes(entity as string)) {
            if (method === 'POST') {
                const keys = Object.keys(req.body);
                const values = Object.values(req.body);
                const toSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                const dbKeys = keys.map(toSnake);

                // Special Handling for Association Tables to support UPSERT
                if (entity === 'resource_skills' || entity === 'project_skills') {
                    // Construct ON CONFLICT clause based on primary key columns
                    const conflictTarget = entity === 'resource_skills' ? '(resource_id, skill_id)' : '(project_id, skill_id)';
                    
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
                    const updateClauses = dbKeys
                        .filter(k => !['resource_id', 'skill_id', 'project_id'].includes(k)) // Don't update PKs
                        .map(k => `${k} = EXCLUDED.${k}`)
                        .join(', ');

                    let query = `INSERT INTO ${entity} (${dbKeys.join(',')}) VALUES (${placeholders})`;
                    
                    if (updateClauses.length > 0) {
                        query += ` ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateClauses}`;
                    } else {
                        // If no columns to update (pure association), DO NOTHING
                        query += ` ON CONFLICT ${conflictTarget} DO NOTHING`;
                    }

                    const { rows } = await client.query(query + ' RETURNING *', values);
                    
                    // Log logic for upsert
                    let entityIdLog = entity === 'resource_skills' ? `${req.body.resourceId}:${req.body.skillId}` : `${req.body.projectId}:${req.body.skillId}`;
                    // If rows is empty (DO NOTHING and exists), fallback log
                    await logAction(client, currentUser, `UPSERT_${(entity as string).toUpperCase()}`, entity as string, entityIdLog, req.body, req);
                    
                    const toCamel = (obj: any) => {
                        if (!obj) return {};
                        const newObj: any = {};
                        for (const key in obj) {
                            newObj[key.replace(/(_\w)/g, k => k[1].toUpperCase())] = obj[key];
                        }
                        return newObj;
                    };
                    return res.status(201).json(rows[0] ? toCamel(rows[0]) : {});
                }

                // Generic Logic for Entity Tables
                if (!keys.includes('id')) {
                    keys.push('id');
                    dbKeys.push('id');
                    values.push(uuidv4());
                }
                
                const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
                const query = `INSERT INTO ${entity} (${dbKeys.join(',')}) VALUES (${placeholders}) RETURNING *`;
                
                const { rows } = await client.query(query, values);
                await logAction(client, currentUser, `CREATE_${(entity as string).toUpperCase()}`, entity as string, rows[0]?.id, req.body, req);

                const toCamel = (obj: any) => {
                    const newObj: any = {};
                    for (const key in obj) {
                        newObj[key.replace(/(_\w)/g, k => k[1].toUpperCase())] = obj[key];
                    }
                    return newObj;
                };
                return res.status(201).json(toCamel(rows[0]));
            }
            
            if (method === 'PUT' && id) {
                const updates = req.body;
                const setClauses = [];
                const values = [];
                let idx = 1;
                
                const toSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

                for (const [key, val] of Object.entries(updates)) {
                    if (key === 'id') continue; 
                    setClauses.push(`${toSnake(key)} = $${idx}`);
                    values.push(val);
                    idx++;
                }
                
                if (setClauses.length === 0) return res.status(200).json(updates);

                values.push(id);
                const query = `UPDATE ${entity} SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
                
                const { rows } = await client.query(query, values);
                await logAction(client, currentUser, `UPDATE_${(entity as string).toUpperCase()}`, entity as string, id as string, updates, req);

                const toCamel = (obj: any) => {
                    const newObj: any = {};
                    for (const key in obj) {
                        newObj[key.replace(/(_\w)/g, k => k[1].toUpperCase())] = obj[key];
                    }
                    return newObj;
                };
                return res.status(200).json(toCamel(rows[0]));
            }

            if (method === 'DELETE') {
                let logId = id as string;
                if (id) {
                    await client.query(`DELETE FROM ${entity} WHERE id = $1`, [id]);
                } else if (entity === 'resource_skills' && req.query.resourceId && req.query.skillId) {
                    await client.query(`DELETE FROM resource_skills WHERE resource_id = $1 AND skill_id = $2`, [req.query.resourceId, req.query.skillId]);
                    logId = `${req.query.resourceId}:${req.query.skillId}`;
                } else if (entity === 'project_skills' && req.query.projectId && req.query.skillId) {
                    await client.query(`DELETE FROM project_skills WHERE project_id = $1 AND skill_id = $2`, [req.query.projectId, req.query.skillId]);
                    logId = `${req.query.projectId}:${req.query.skillId}`;
                }
                await logAction(client, currentUser, `DELETE_${(entity as string).toUpperCase()}`, entity as string, logId, {}, req);
                return res.status(204).end();
            }
        }
        
        // --- EMERGENCY RESET ---
        if (entity === 'emergency_reset' && method === 'POST') {
             const salt = await bcrypt.genSalt(10);
             const hash = await bcrypt.hash('admin', salt);
             await client.query("UPDATE app_users SET password_hash = $1 WHERE username = 'admin'", [hash]);
             await logAction(client, null, 'EMERGENCY_RESET', 'app_users', null, {}, req);
             return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Unknown entity or method' });

    } catch (error) {
        console.error(`API Error in resources.ts [${method} ${entity}]:`, error);
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
