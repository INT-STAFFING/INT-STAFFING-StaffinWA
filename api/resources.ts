
import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'staffing-app-secret-key-change-in-prod';

const logAction = async (client: any, user: any, action: string, entity: string, entityId: string | undefined, details: any, req: VercelRequest) => {
    try {
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
        const userId = user ? user.userId : null;
        const username = user ? user.username : 'system';
        
        // Ensure user_id is a valid UUID or null if not available
        await client.sql`
            INSERT INTO action_logs (user_id, username, action, entity, entity_id, details, ip_address)
            VALUES (${userId}, ${username}, ${action}, ${entity}, ${entityId}, ${JSON.stringify(details)}, ${ip})
        `;
    } catch (e) {
        console.error("Failed to log action:", e);
    }
};

const verifyToken = (req: VercelRequest) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    try {
        return jwt.verify(token, JWT_SECRET) as any;
    } catch (e) {
        return null;
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { entity, id, action } = req.query;
    const method = req.method;
    
    // Custom Actions Dispatcher (Non-Standard CRUD)
    if (action) {
        // Special handlers for specific actions (e.g. bulk password reset, db inspector queries)
        // For simplicity, these are implemented inline or could be separated.
        // Assuming custom actions are handled by other files or specific checks here.
        // This block is a placeholder for custom logic if needed before generic CRUD.
    }

    const client = await db.connect();
    const currentUser = verifyToken(req);

    try {
        const validTables = [
            'resources', 'projects', 'clients', 'roles', 'company_calendar', 
            'interviews', 'contracts', 'resource_skills', 'project_skills',
            'skill_macro_categories', 'skill_categories', 'skills', 
            'leave_types', 'leave_requests', 'resource_requests', 'project_activities',
            'contract_projects', 'contract_managers', 'app_config', 'app_users', 'role_permissions',
            'notifications', 'analytics_cache', 'horizontals', 'seniority_levels', 'project_statuses', 'client_sectors', 'locations'
        ];
        
        if (!entity || !validTables.includes(entity as string)) {
             return res.status(400).json({ error: 'Invalid or missing entity' });
        }

        const tableName = entity as string;

        if (method === 'POST') {
            const body = req.body;
            if (!body) return res.status(400).json({ error: 'Body required' });
            
            // Generate ID if not present and table has ID column (simplified check)
            if (!body.id && tableName !== 'resource_skills' && tableName !== 'project_skills' && tableName !== 'contract_projects' && tableName !== 'contract_managers' && tableName !== 'role_permissions') {
                body.id = uuidv4();
            }

            const keys = Object.keys(body);
            const values = Object.values(body);
            
            // CamelCase to snake_case conversion for DB columns
            const dbKeys = keys.map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
            
            const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
            // Construct query safely with validated table name
            const query = `INSERT INTO ${tableName} (${dbKeys.join(',')}) VALUES (${placeholders}) RETURNING *`;
            
            const { rows } = await client.query(query, values);
            await logAction(client, currentUser, `CREATE_${tableName.toUpperCase()}`, tableName, rows[0]?.id, req.body, req);

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
            
            // SIDE EFFECT: Project Completion Cascade
            if (tableName === 'projects' && updates.status === 'Completato') {
                await client.query(
                    `UPDATE project_activities SET status = 'Conclusa', updated_at = NOW() WHERE project_id = $1`,
                    [id]
                );
            }

            if (tableName === 'project_activities') {
                updates.updatedAt = new Date().toISOString();
            }

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
            const query = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
            
            const { rows } = await client.query(query, values);
            await logAction(client, currentUser, `UPDATE_${tableName.toUpperCase()}`, tableName, id as string, updates, req);

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
            // Check composite keys for specific tables if passed via query params
            // Simplified: Assuming 'id' is enough for most or composite logic is handled via custom query string logic if needed
            // For now, support id deletion.
            if (id) {
                await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
                await logAction(client, currentUser, `DELETE_${tableName.toUpperCase()}`, tableName, id as string, {}, req);
                return res.status(204).end();
            } else if (req.query.resource_id && req.query.skill_id && tableName === 'resource_skills') {
                 // Example composite delete
                 await client.query(`DELETE FROM resource_skills WHERE resource_id = $1 AND skill_id = $2`, [req.query.resource_id, req.query.skill_id]);
                 return res.status(204).end();
            } else if (req.query.project_id && req.query.skill_id && tableName === 'project_skills') {
                 await client.query(`DELETE FROM project_skills WHERE project_id = $1 AND skill_id = $2`, [req.query.project_id, req.query.skill_id]);
                 return res.status(204).end();
            }
             
            return res.status(400).json({ error: 'Missing ID for delete' });
        }
        
        if (method === 'GET') {
            let query = `SELECT * FROM ${tableName}`;
            const values: any[] = [];
            
            if (id) {
                query += ` WHERE id = $1`;
                values.push(id);
            }
            
            const { rows } = await client.query(query, values);
            
            const toCamel = (obj: any) => {
                const newObj: any = {};
                for (const key in obj) {
                    newObj[key.replace(/(_\w)/g, k => k[1].toUpperCase())] = obj[key];
                }
                return newObj;
            };
            
            if (id) {
                return res.status(200).json(rows.length ? toCamel(rows[0]) : null);
            }
            return res.status(200).json(rows.map(toCamel));
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
