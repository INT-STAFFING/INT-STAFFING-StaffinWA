
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
        const eventDate = event.date instanceof Date ? event.date.toISOString().split('T')[0] : event.date;
        if (eventDate !== dateStr) return false;
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
    const calendar = calendarRes.rows.map((e: any) => ({ ...e, date: e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date }));
    const roles = rolesRes.rows;
    const history = historyRes.rows;

    const getRate = (resource: any, date: Date) => {
        if (resource.daily_cost && Number(resource.daily_cost) > 0) {
            return Number(resource.daily_cost);
        }
        
        const dStr = date.toISOString().split('T')[0];
        const h = history.find((r: any) => r.role_id === resource.role_id && dStr >= r.start_date.toISOString().split('T')[0] && (!r.end_date || dStr <= r.end_date.toISOString().split('T')[0]));
        if (h) return Number(h.daily_cost);
        const r = roles.find((role: any) => role.id === resource.role_id);
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
            const isHol = isHolidayInternal(cur, res.location, calendar);
            
            if (pct && !isHol && cur.getDay() !== 0 && cur.getDay() !== 6) {
                const fraction = pct / 100;
                const cost = fraction * getRate(res, cur) * (proj.realization_percentage / 100);
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

const TABLE_MAPPING: Record<string, string> = {
    'leaves': 'leave_requests',
    'leave_types': 'leave_types',
    'role-permissions': 'role_permissions',
    'security-users': 'app_users',
    'rate_cards': 'rate_cards',
    'rate_card_entries': 'rate_card_entries',
    'project_expenses': 'project_expenses',
    'billing_milestones': 'billing_milestones'
};

const toCamelAndNormalize = (o: any) => {
    if (!o) return {};
    const n: any = {};
    for (const k in o) {
        const camelKey = k.replace(/(_\w)/g, m => m[1].toUpperCase());
        let value = o[k];
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
    const tableName = TABLE_MAPPING[entity as string] || entity;

    try {
        if (method === 'POST' && entity === 'resources' && action === 'best_fit') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });

            const { startDate, endDate, roleId, projectId, commitmentPercentage } = req.body;
            
            const [resources, assignments, allocations, calendar, resSkills, projSkills, roles, project, leaves] = await Promise.all([
                client.query('SELECT * FROM resources WHERE resigned = FALSE'),
                client.query('SELECT * FROM assignments'),
                client.query('SELECT * FROM allocations WHERE allocation_date >= $1 AND allocation_date <= $2', [startDate, endDate]),
                client.query('SELECT * FROM company_calendar'),
                client.query('SELECT rs.*, s.name as skill_name FROM resource_skills rs JOIN skills s ON rs.skill_id = s.id'),
                client.query('SELECT ps.*, s.name as skill_name FROM project_skills ps JOIN skills s ON ps.skill_id = s.id WHERE ps.project_id = $1', [projectId]),
                client.query('SELECT * FROM roles'),
                client.query('SELECT * FROM projects WHERE id = $1', [projectId]),
                client.query('SELECT * FROM leave_requests WHERE status = \'APPROVED\' AND start_date <= $2 AND end_date >= $1', [startDate, endDate])
            ]);

            const targetRole = roles.rows.find((r:any) => r.id === roleId);
            const targetSkills = projSkills.rows;
            const start = new Date(startDate);
            const end = new Date(endDate);
            const requestedLoad = Number(commitmentPercentage) || 100;

            const scoredResources = resources.rows.map((res: any) => {
                let score = 0;
                const details: any = { availability: 0, skillMatch: 0, roleMatch: 0, costEff: 0 };
                
                const resAssignments = assignments.rows.filter((a:any) => a.resource_id === res.id);
                const resLeaves = leaves.rows.filter((l:any) => l.resource_id === res.id);

                let totalAllocatedPct = 0;
                let workingDays = 0;
                
                let cur = new Date(start);
                while(cur <= end) {
                    const dStr = cur.toISOString().split('T')[0];
                    const isHol = isHolidayInternal(cur, res.location, calendar.rows);
                    
                    if (!isHol && cur.getDay() !== 0 && cur.getDay() !== 6) {
                        workingDays++;
                        
                        const activeLeave = resLeaves.find((l:any) => {
                             const lStart = l.start_date.toISOString().split('T')[0];
                             const lEnd = l.end_date.toISOString().split('T')[0];
                             return dStr >= lStart && dStr <= lEnd;
                        });

                        if (activeLeave) {
                             if (activeLeave.is_half_day) totalAllocatedPct += 50;
                             else totalAllocatedPct += 100;
                        } else {
                            resAssignments.forEach((a:any) => {
                                const alloc = allocations.rows.find((al:any) => al.assignment_id === a.id && al.allocation_date.toISOString().split('T')[0] === dStr);
                                if(alloc) totalAllocatedPct += alloc.percentage;
                            });
                        }
                    }
                    cur.setDate(cur.getDate() + 1);
                }

                const avgLoad = workingDays > 0 ? totalAllocatedPct / workingDays : 0;
                const maxCapacity = res.max_staffing_percentage || 100;
                const remainingCapacity = Math.max(0, maxCapacity - avgLoad);
                
                let availabilityScore = 0;
                if (remainingCapacity >= requestedLoad) {
                    availabilityScore = 100;
                } else {
                    availabilityScore = (remainingCapacity / requestedLoad) * 100;
                }

                score += availabilityScore * 0.4;
                details.availability = availabilityScore;
                details.avgLoad = avgLoad;

                if (targetSkills.length > 0) {
                    const mySkills = resSkills.rows.filter((rs:any) => rs.resource_id === res.id);
                    let matchedCount = 0;
                    let weightedSkillScore = 0;
                    
                    targetSkills.forEach((ts:any) => {
                        const match = mySkills.find((ms:any) => ms.skill_id === ts.skill_id);
                        if (match) {
                            matchedCount++;
                            weightedSkillScore += 100 * ((match.level || 3) / 5);
                        }
                    });
                    const skillScore = (weightedSkillScore / targetSkills.length);
                    score += skillScore * 0.3;
                    details.skillMatch = skillScore;
                    details.matchedSkillsCount = matchedCount;
                } else {
                    score += 50 * 0.3; 
                    details.skillMatch = 50;
                }

                let roleScore = 0;
                if (res.role_id === roleId) {
                    roleScore = 100;
                } else {
                    const myRole = roles.rows.find((r:any) => r.id === res.role_id);
                    if (myRole && targetRole) {
                        if (myRole.seniority_level === targetRole.seniority_level) roleScore = 70;
                        else roleScore = 30;
                    }
                }
                score += roleScore * 0.2;
                details.roleMatch = roleScore;

                let costScore = 50;
                if (targetRole) {
                    const myRole = roles.rows.find((r:any) => r.id === res.role_id);
                    const specificCost = Number(res.daily_cost);
                    const myCost = specificCost > 0 ? specificCost : Number(myRole?.daily_cost || 0);
                    const targetCost = Number(targetRole.daily_cost || 0);
                    
                    if (myCost <= targetCost) costScore = 100; 
                    else {
                        const diffPct = (myCost - targetCost) / targetCost;
                        costScore = Math.max(0, 100 - (diffPct * 200));
                    }
                }
                score += costScore * 0.1;
                details.costEff = costScore;

                return {
                    resource: toCamelAndNormalize(res),
                    score: Math.round(score),
                    details
                };
            });

            scoredResources.sort((a:any, b:any) => b.score - a.score);
            await logAction(client, currentUser, 'RUN_BEST_FIT', 'resources', null, { projectId, roleId, candidatesFound: scoredResources.length }, req);
            return res.status(200).json(scoredResources.slice(0, 10));
        }

        if (method === 'GET') {
            const sensitiveEntities = ['app-users', 'role-permissions', 'audit_logs', 'db_inspector', 'theme', 'security-users'];
            if (sensitiveEntities.includes(entity as string) && !verifyAdmin(req)) {
                return res.status(403).json({ error: 'Forbidden: Admin access required for this entity.' });
            }

            // Simple GET list or single
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
                if (q.targetEntity) { conditions.push(`entity = $${idx++}`); params.push(q.targetEntity); }
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
            const dailyExpenses = (Number(dailyCost) || 0) * 0.035;

            await client.query('UPDATE roles SET name=$1, seniority_level=$2, daily_cost=$3, standard_cost=$4, daily_expenses=$5 WHERE id=$6', [name, seniorityLevel, dailyCost, standardCost, dailyExpenses, id]);
            
            if (Number(oldCost) !== Number(dailyCost)) {
                await client.query('UPDATE role_cost_history SET end_date = CURRENT_DATE WHERE role_id = $1 AND end_date IS NULL', [id]);
                await client.query('INSERT INTO role_cost_history (id, role_id, daily_cost, start_date) VALUES ($1, $2, $3, CURRENT_DATE)', [uuidv4(), id, dailyCost]);
            }
            await logAction(client, currentUser, 'UPDATE', 'roles', id as string, { name, dailyCost }, req);
            await client.query('COMMIT');
            return res.status(200).json({ id, ...req.body });
        }

        // Generic CRUD Handlers
        if (method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             const body = req.body;
             const newId = uuidv4();
             const columns = Object.keys(body).map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
             const values = Object.values(body);
             const placeholders = values.map((_, i) => `$${i + 2}`); // $1 is id

             const q = `INSERT INTO ${tableName} (id, ${columns.join(', ')}) VALUES ($1, ${placeholders.join(', ')})`;
             await client.query(q, [newId, ...values]);
             await logAction(client, currentUser, 'CREATE', tableName as string, newId, body, req);
             return res.status(201).json({ id: newId, ...body });
        }

        if (method === 'PUT') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            const body = req.body;
            const updates = Object.entries(body).map(([k, v], i) => {
                const col = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                return `${col} = $${i + 1}`;
            });
            const values = Object.values(body);
            const q = `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${values.length + 1}`;
            await client.query(q, [...values, id]);
            await logAction(client, currentUser, 'UPDATE', tableName as string, id as string, body, req);
            return res.status(200).json({ id, ...body });
        }

        if (method === 'DELETE') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
             await logAction(client, currentUser, 'DELETE', tableName as string, id as string, {}, req);
             return res.status(204).end();
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Resource API Error:', error);
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
