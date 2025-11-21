
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action, table, dialect } = req.query;
    const client = await db.connect();

    try {
        // --- CONFIG BATCH UPDATE ---
        if (entity === 'app-config-batch' && method === 'POST') {
            const { updates } = req.body; // [{ key, value }]
            if (!Array.isArray(updates)) throw new Error('Invalid updates format');
            
            await client.query('BEGIN');
            for (const { key, value } of updates) {
                await client.query(`
                    INSERT INTO app_config (key, value) VALUES ($1, $2)
                    ON CONFLICT (key) DO UPDATE SET value = $2
                `, [key, value]);
            }
            await client.query('COMMIT');
            return res.status(200).json({ success: true });
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

        // --- APP USERS & AUTH MANAGEMENT (PROTECTED) ---
        if (entity === 'app-users') {
            if (!verifyAdmin(req) && action !== 'change_password') {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            // Change Password (Self or Admin) - We allow self service if token matches ID, but here for simplicity we check admin or valid session
            if (action === 'change_password' && method === 'PUT') {
                const { newPassword } = req.body;
                // Ideally verify that the requesting user is the one being changed or is admin
                // For MVP, we trust the token presence in AuthContext + backend check if strict
                const hash = await bcrypt.hash(newPassword, 10);
                await client.query('UPDATE app_users SET password_hash = $1 WHERE id = $2', [hash, id]);
                return res.status(200).json({ success: true });
            }
            
            if (method === 'GET') {
                const { rows } = await client.query(`
                    SELECT u.id, u.username, u.role, u.is_active, u.resource_id, r.name as "resourceName"
                    FROM app_users u
                    LEFT JOIN resources r ON u.resource_id = r.id
                    ORDER BY u.username
                `);
                return res.status(200).json(rows.map(r => ({
                    ...r,
                    isActive: r.is_active, // Map snake_case to camelCase
                    resourceId: r.resource_id
                })));
            }
            if (method === 'POST') {
                const { username, password, role, isActive, resourceId } = req.body;
                const hash = await bcrypt.hash(password, 10);
                const newId = uuidv4();
                await client.query(
                    'INSERT INTO app_users (id, username, password_hash, role, is_active, resource_id) VALUES ($1, $2, $3, $4, $5, $6)',
                    [newId, username, hash, role, isActive, resourceId || null]
                );
                return res.status(201).json({ id: newId });
            }
            if (method === 'PUT') {
                const { username, role, isActive, resourceId } = req.body;
                await client.query(
                    'UPDATE app_users SET username=$1, role=$2, is_active=$3, resource_id=$4 WHERE id=$5',
                    [username, role, isActive, resourceId || null, id]
                );
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await client.query('DELETE FROM app_users WHERE id=$1', [id]);
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
                const { resourceId, typeId, startDate, endDate, status, managerId, approverIds, notes } = req.body;
                const newId = uuidv4();
                // Convert array for postgres safely
                const approverIdsPg = approverIds && approverIds.length > 0 ? `{${approverIds.join(',')}}` : null;
                
                await client.query(`
                    INSERT INTO leave_requests (id, resource_id, type_id, start_date, end_date, status, manager_id, approver_ids, notes) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [newId, resourceId, typeId, startDate, endDate, status, managerId || null, approverIdsPg, notes]);
                
                return res.status(201).json({ id: newId, ...req.body });
            }
            if (method === 'PUT') {
                const { resourceId, typeId, startDate, endDate, status, managerId, approverIds, notes } = req.body;
                
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
                
                query = query.slice(0, -2) + ` WHERE id=$${idx}`;
                params.push(id);
                
                await client.query(query, params);
                return res.status(200).json({ id, ...req.body });
            }
            if (method === 'DELETE') {
                await client.query('DELETE FROM leave_requests WHERE id=$1', [id]);
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
                return res.status(200).json({ success: true });
            }
            if (action === 'delete_all_rows' && table) {
                await client.query(`DELETE FROM ${table}`);
                return res.status(200).json({ success: true });
            }
            if (action === 'export_sql' && dialect) {
                return res.status(400).json({ error: 'Use /api/export-sql endpoint' });
            }
        }

        // --- GENERIC CRUD ---
        const validTables = [
            'resources', 'projects', 'clients', 'roles', 'skills', 'company_calendar', 
            'interviews', 'contracts', 'resource_skills', 'project_skills'
        ];
        
        if (validTables.includes(entity as string)) {
            if (method === 'POST') {
                const keys = Object.keys(req.body);
                const values = Object.values(req.body);
                
                if (!keys.includes('id') && entity !== 'resource_skills' && entity !== 'project_skills') {
                    keys.push('id');
                    values.push(uuidv4());
                }
                
                const toSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                const dbKeys = keys.map(toSnake);
                
                const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
                const query = `INSERT INTO ${entity} (${dbKeys.join(',')}) VALUES (${placeholders}) RETURNING *`;
                
                const { rows } = await client.query(query, values);
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
                if (id) {
                    await client.query(`DELETE FROM ${entity} WHERE id = $1`, [id]);
                } else if (entity === 'resource_skills' && req.query.resourceId && req.query.skillId) {
                    await client.query(`DELETE FROM resource_skills WHERE resource_id = $1 AND skill_id = $2`, [req.query.resourceId, req.query.skillId]);
                } else if (entity === 'project_skills' && req.query.projectId && req.query.skillId) {
                    await client.query(`DELETE FROM project_skills WHERE project_id = $1 AND skill_id = $2`, [req.query.projectId, req.query.skillId]);
                }
                return res.status(204).end();
            }
        }
        
        // --- EMERGENCY RESET ---
        if (entity === 'emergency_reset' && method === 'POST') {
             const salt = await bcrypt.genSalt(10);
             const hash = await bcrypt.hash('admin', salt);
             await client.query("UPDATE app_users SET password_hash = $1 WHERE username = 'admin'", [hash]);
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
