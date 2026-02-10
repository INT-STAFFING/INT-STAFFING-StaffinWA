
import { db } from './db.js';
import { ensureDbTablesExist } from './schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from '../libs/zod.js';
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

const TABLE_MAPPING: Record<string, string> = {
    'leaves': 'leave_requests',
    'leave_types': 'leave_types',
    'role-permissions': 'role_permissions',
    'security-users': 'app_users',
    'app-users': 'app_users',
    'rate_cards': 'rate_cards',
    'rate_card_entries': 'rate_card_entries',
    'project_expenses': 'project_expenses',
    'billing_milestones': 'billing_milestones',
    'audit_logs': 'action_logs',
    'analytics_cache': 'analytics_cache',
    'notification_configs': 'notification_configs',
    'resource_skills': 'resource_skills',
    'project_skills': 'project_skills',
    'contract_projects': 'contract_projects',
    'contract_managers': 'contract_managers',
    'notifications': 'notifications',
    'app_config': 'app_config',
    'skill_categories': 'skill_categories',
    'skill_macro_categories': 'skill_macro_categories',
    'resource_evaluations': 'resource_evaluations',
    'evaluation_metrics': 'evaluation_metrics'
};

// Generic Schema for fallback, specific ones below
const VALIDATION_SCHEMAS: Record<string, any> = {
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
        dailyCost: z.number().optional().nullable(),
        isTalent: z.boolean().optional().nullable(),
        seniorityCode: z.string().optional().nullable()
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
    }),
    'skills': z.object({
        name: z.string(),
        isCertification: z.boolean().optional().nullable(),
        categoryIds: z.array(z.string()).optional().nullable() // Virtual field for creation
    }),
    'skill_categories': z.object({
        name: z.string(),
        macroCategoryIds: z.array(z.string()).optional().nullable() // Virtual field for creation
    }),
    'skill_macro_categories': z.object({
        name: z.string()
    }),
    'resource_skills': z.object({
        resourceId: z.string(),
        skillId: z.string(),
        level: z.number().optional().nullable(),
        acquisitionDate: z.string().optional().nullable(),
        expirationDate: z.string().optional().nullable()
    }),
    'project_skills': z.object({
        projectId: z.string(),
        skillId: z.string()
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
    'contract_projects': z.object({
        contractId: z.string(),
        projectId: z.string()
    }),
    'contract_managers': z.object({
        contractId: z.string(),
        resourceId: z.string()
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
        status: z.string().optional(),
        managerId: z.string().optional().nullable(),
        approverIds: z.array(z.string()).optional().nullable(),
        notes: z.string().optional().nullable(),
        isHalfDay: z.boolean().optional().nullable()
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
    'app_users': z.object({
        username: z.string(),
        role: z.string(),
        resourceId: z.string().optional().nullable(),
        isActive: z.boolean().optional().nullable()
    }),
    'notification_configs': z.object({
        eventType: z.string(),
        webhookUrl: z.string(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional()
    }),
    'interviews': z.object({
        resourceRequestId: z.string().optional().nullable(),
        candidateName: z.string(),
        candidateSurname: z.string(),
        birthDate: z.string().optional().nullable(),
        horizontal: z.string().optional().nullable(),
        roleId: z.string().optional().nullable(),
        cvSummary: z.string().optional().nullable(),
        interviewersIds: z.array(z.string()).optional().nullable(),
        interviewDate: z.string().optional().nullable(),
        feedback: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        hiringStatus: z.string().optional().nullable(),
        entryDate: z.string().optional().nullable(),
        status: z.string(),
        ratingTechnicalMastery: z.number().optional().nullable(),
        ratingProblemSolving: z.number().optional().nullable(),
        ratingMethodQuality: z.number().optional().nullable(),
        ratingDomainKnowledge: z.number().optional().nullable(),
        ratingAutonomy: z.number().optional().nullable(),
        ratingCommunication: z.number().optional().nullable(),
        ratingProactivity: z.number().optional().nullable(),
        ratingTeamFit: z.number().optional().nullable()
    }),
    'resource_evaluations': z.object({
        resourceId: z.string(),
        fiscalYear: z.number(),
        evaluatorId: z.string().optional().nullable(),
        status: z.string().optional(),
        overallRating: z.number().optional().nullable(),
        summary: z.string().optional().nullable(),
        // Nested metrics for transactional save
        metrics: z.array(z.object({
             category: z.string(),
             metricKey: z.string(),
             metricValue: z.string().optional().nullable(),
             score: z.number().optional().nullable()
        })).optional()
    })
};

const toCamelAndNormalize = (o: any) => {
    if (!o) return {};
    const n: any = {};
    for (const k in o) {
        const camelKey = k.replace(/(_\w)/g, m => m[1].toUpperCase());
        const value = o[k];
        if (value instanceof Date && (camelKey.endsWith('Date') || camelKey === 'date' || camelKey === 'lastDayOfWork' || camelKey === 'updatedAt')) {
            if (camelKey === 'updatedAt') {
                 n[camelKey] = value.toISOString(); // Keep timestamp
            } else {
                 const y = value.getFullYear();
                 const m = String(value.getMonth() + 1).padStart(2, '0');
                 const d = String(value.getDate()).padStart(2, '0');
                 n[camelKey] = `${y}-${m}-${d}`;
            }
        } else {
            n[camelKey] = value;
        }
    }
    return n;
};

const triggerNotification = async (client: any, method: string, tableName: string, id: string | null, data: any, oldData: any = null) => {
    try {
        if (method === 'POST') {
            if (tableName === 'resources') {
                await notify(client, 'RESOURCE_CREATED', {
                    title: 'Nuova Risorsa Inserita',
                    color: 'Good',
                    facts: [{ name: 'Nome', value: data.name }, { name: 'Ruolo', value: data.roleId || 'N/A' }]
                });
            } else if (tableName === 'projects') {
                await notify(client, 'PROJECT_CREATED', {
                    title: 'Nuovo Progetto Creato',
                    color: 'Good',
                    facts: [{ name: 'Progetto', value: data.name }, { name: 'Budget', value: `${data.budget} €` }]
                });
            }
        } else if (method === 'PUT' && tableName === 'interviews') {
            if (data.feedback && data.feedback !== oldData?.feedback) {
                const ratingKeys = [
                    'ratingTechnicalMastery', 'ratingProblemSolving', 'ratingMethodQuality',
                    'ratingDomainKnowledge', 'ratingAutonomy', 'ratingCommunication',
                    'ratingProactivity', 'ratingTeamFit'
                ];
                
                let sum = 0;
                let count = 0;
                const detailedFacts: { name: string, value: string }[] = [];

                ratingKeys.forEach(key => {
                    if (data[key] && Number(data[key]) > 0) {
                        sum += Number(data[key]);
                        count++;
                        const readableKey = key.replace('rating', '').replace(/([A-Z])/g, ' $1').trim();
                        detailedFacts.push({ name: readableKey, value: `${Number(data[key])}/5` });
                    }
                });

                const average = count > 0 ? sum / count : 0;
                const stars = "⭐".repeat(Math.round(average)) + "☆".repeat(5 - Math.round(average));
                const chartColor = average >= 4 ? '#4caf50' : average >= 3 ? '#ff9800' : '#f44336';
                const chartConfig = {
                    type: 'radialGauge',
                    data: { datasets: [{ data: [average], backgroundColor: chartColor }] },
                    options: { domain: [0, 5], trackColor: '#e0e0e0', centerPercentage: 80, centerArea: { text: average.toFixed(1), fontColor: chartColor, fontSize: 50, fontFamily: 'Arial', fontWeight: 'bold' } }
                };
                const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig));
                const imageUrl = `https://quickchart.io/chart?c=${encodedConfig}&w=300&h=300`;

                await notify(client, 'INTERVIEW_FEEDBACK', {
                    title: `Feedback Inserito: ${data.candidateName} ${data.candidateSurname}`,
                    color: average >= 3.5 ? 'Good' : average >= 2.5 ? 'Warning' : 'Attention',
                    imageUrl: imageUrl,
                    imageCaption: `Valutazione Media: ${average.toFixed(1)} su 5`,
                    facts: [
                        { name: 'Candidato', value: `${data.candidateName} ${data.candidateSurname}` },
                        { name: 'Esito', value: data.feedback },
                        { name: 'Media Voto', value: `${stars} (${average.toFixed(1)})` },
                        { name: 'Stato', value: data.status || 'N/A' }
                    ],
                    detailedFacts: detailedFacts
                });

                const rrId = data.resourceRequestId || oldData?.resourceRequestId;
                if (rrId) {
                    const reqRes = await client.query('SELECT requestor_id FROM resource_requests WHERE id = $1', [rrId]);
                    const requestorId = reqRes.rows[0]?.requestor_id;
                    if (requestorId) {
                         const candidate = data.candidateName || oldData?.candidateName || 'Candidato';
                         await client.query(
                            `INSERT INTO notifications (id, recipient_resource_id, title, message, link, created_at) 
                             VALUES ($1, $2, $3, $4, $5, NOW())`,
                            [uuidv4(), requestorId, 'Feedback Colloquio', `Nuovo feedback inserito per ${candidate}: ${data.feedback}. Media: ${average.toFixed(1)}/5`, '/interviews']
                        );
                    }
                }
            }
        }
    } catch (err) { console.error("Notification trigger failed", err); }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action, resourceId, skillId, projectId, contractId, table } = req.query;
    await ensureDbTablesExist(db);
    const client = await db.connect();
    const currentUser = getUserFromRequest(req);
    const tableName = TABLE_MAPPING[entity as string] || entity;

    try {
        // --- DB INSPECTOR (ADMIN ONLY) ---
        if (entity === 'db_inspector') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

            if (action === 'list_tables') {
                const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
                return res.status(200).json(result.rows.map(r => r.table_name));
            }
            if (action === 'get_table_data' && table) {
                const limit = 100;
                // Basic SQL injection prevention by checking against valid tables
                const validTablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
                const validTables = validTablesRes.rows.map(r => r.table_name);
                if (!validTables.includes(table as string)) return res.status(400).json({ error: 'Invalid table' });

                const result = await client.query(`SELECT * FROM ${table} LIMIT $1`, [limit]);
                const columns = result.fields.map(f => ({ column_name: f.name, data_type: f.dataTypeID })); // Simplified
                return res.status(200).json({ columns, rows: result.rows });
            }
            if (action === 'update_row' && table && id) {
                 // Basic Dynamic Update - highly simplified for inspector
                 const updates = req.body;
                 const validTablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
                 if (!validTablesRes.rows.map(r => r.table_name).includes(table as string)) return res.status(400).json({ error: 'Invalid table' });
                 
                 const keys = Object.keys(updates);
                 const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
                 const values = Object.values(updates);
                 await client.query(`UPDATE ${table} SET ${setClause} WHERE id = $${values.length + 1}`, [...values, id]);
                 return res.status(200).json({ success: true });
            }
            if (action === 'delete_all_rows' && table) {
                 const validTablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
                 if (!validTablesRes.rows.map(r => r.table_name).includes(table as string)) return res.status(400).json({ error: 'Invalid table' });
                 await client.query(`TRUNCATE TABLE ${table} CASCADE`);
                 return res.status(200).json({ success: true });
            }
            if (action === 'run_raw_query') {
                const { query } = req.body;
                if (!query) return res.status(400).json({ error: 'No query provided' });
                // RAW QUERY - EXTREME CAUTION - Admin only verified above
                const result = await client.query(query);
                return res.status(200).json({ 
                    rows: result.rows, 
                    fields: result.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })), 
                    rowCount: result.rowCount, 
                    command: result.command 
                });
            }
        }

        // --- APP CONFIG BATCH ---
        if (entity === 'app-config-batch' && method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             const { updates } = req.body;
             if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid updates format' });
             
             await client.query('BEGIN');
             for (const { key, value } of updates) {
                 await client.query(
                     `INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
                     [key, value]
                 );
             }
             await client.query('COMMIT');
             return res.status(200).json({ success: true });
        }

        // --- BEST FIT ---
        if (entity === 'resources' && action === 'best_fit' && method === 'POST') {
             const { roleId, projectId, startDate, endDate, commitmentPercentage } = req.body;
             // Simplified Logic: Return resources with correct role and calculate a mock score
             // In production, this would query Allocations to check availability
             const resQuery = `
                SELECT r.*, ro.name as role_name 
                FROM resources r 
                LEFT JOIN roles ro ON r.role_id = ro.id
                WHERE r.resigned = FALSE 
                ${roleId ? `AND r.role_id = $1` : ''}
                LIMIT 10
             `;
             const params = roleId ? [roleId] : [];
             const { rows } = await client.query(resQuery, params);
             
             const scoredResources = rows.map(r => ({
                 resource: toCamelAndNormalize(r),
                 score: Math.floor(Math.random() * 30) + 70, // Mock score for now
                 details: {
                     availability: Math.floor(Math.random() * 100),
                     skillMatch: Math.floor(Math.random() * 100),
                     roleMatch: r.role_id === roleId ? 100 : 50
                 }
             })).sort((a, b) => b.score - a.score);
             
             return res.status(200).json(scoredResources);
        }

        // --- ANALYTICS RECALC ---
        if (entity === 'analytics_cache' && action === 'recalc_all' && method === 'POST') {
             // Invalidate all cache
             await client.query(`DELETE FROM analytics_cache`);
             return res.status(200).json({ message: "Cache cleared", data: {} });
        }

        // --- SPECIAL NOTIFICATION HANDLING ---
        if (entity === 'notifications') {
            if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
            const { rows: userRows } = await client.query('SELECT resource_id FROM app_users WHERE id = $1', [currentUser.id]);
            const userResourceId = userRows[0]?.resource_id;

            if (!userResourceId && currentUser.role !== 'ADMIN') return res.status(403).json({ error: 'User not linked to a resource.' });

            if (method === 'GET') {
                const query = `SELECT * FROM notifications WHERE recipient_resource_id = $1 ORDER BY created_at DESC`;
                const { rows } = await client.query(query, [userResourceId]);
                return res.status(200).json(rows.map(toCamelAndNormalize));
            }
            if (method === 'PUT' && action === 'mark_read') {
                if (id) await client.query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_resource_id = $2`, [id, userResourceId]);
                else await client.query(`UPDATE notifications SET is_read = TRUE WHERE recipient_resource_id = $1`, [userResourceId]);
                return res.status(200).json({ success: true });
            }
        }
        
        // --- SPECIAL: APP USERS ACTIONS (Impersonation & Security) ---
        if (entity === 'app-users') {
             if (action === 'impersonate' && method === 'POST') {
                 if (!verifyAdmin(req)) return res.status(403).json({ error: 'Only admins can impersonate.' });
                 const targetUserId = id as string;
                 const { rows } = await client.query('SELECT * FROM app_users WHERE id = $1', [targetUserId]);
                 const targetUser = rows[0];
                 if (!targetUser) return res.status(404).json({ error: 'User not found' });
                 
                 const token = jwt.sign({ userId: targetUser.id, username: targetUser.username, role: targetUser.role }, JWT_SECRET!, { expiresIn: '4h' });
                 const permRes = await client.query('SELECT page_path FROM role_permissions WHERE role = $1 AND is_allowed = TRUE', [targetUser.role]);
                 const permissions = permRes.rows.map(r => r.page_path);
                 
                 if (currentUser) {
                    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
                    await client.query(`INSERT INTO action_logs (user_id, username, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)`, [currentUser.id, currentUser.username, 'IMPERSONATE', JSON.stringify({ target: targetUser.username }), ip]);
                 }
                 return res.status(200).json({ success: true, token, user: { id: targetUser.id, username: targetUser.username, role: targetUser.role, resourceId: targetUser.resource_id, permissions, mustChangePassword: false } });
             }

             if (action === 'change_password' && method === 'PUT') {
                 if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
                 const targetUserId = id as string;
                 const isAdmin = verifyAdmin(req);
                 const isSelf = currentUser.id === targetUserId;
                 if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Forbidden' });

                 const { newPassword } = req.body;
                 if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Invalid password (min 8 chars)' });

                 const salt = await bcrypt.genSalt(10);
                 const hashedPassword = await bcrypt.hash(newPassword, salt);
                 const mustChange = isAdmin && !isSelf;

                 await client.query(`UPDATE app_users SET password_hash = $1, must_change_password = $2, version = version + 1 WHERE id = $3`, [hashedPassword, mustChange, targetUserId]);
                 const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
                 await client.query(`INSERT INTO action_logs (user_id, username, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)`, [currentUser.id, currentUser.username, 'PASSWORD_CHANGE', JSON.stringify({ targetId: targetUserId, forced: mustChange }), ip]);

                 return res.status(200).json({ success: true });
             }
             
             if (action === 'bulk_password_reset' && method === 'POST') {
                 if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
                 const { users } = req.body;
                 if (!Array.isArray(users)) return res.status(400).json({ error: 'Invalid data' });
                 
                 let successCount = 0;
                 let failCount = 0;
                 const salt = await bcrypt.genSalt(10);

                 for (const u of users) {
                     try {
                         const hash = await bcrypt.hash(u.password, salt);
                         const res = await client.query(`UPDATE app_users SET password_hash = $1, must_change_password = TRUE, version = version + 1 WHERE username = $2`, [hash, u.username]);
                         if (res.rowCount && res.rowCount > 0) successCount++; else failCount++;
                     } catch (e) { failCount++; }
                 }
                 return res.status(200).json({ successCount, failCount });
             }
        }

        // --- GENERIC CRUD ---
        if (method === 'GET') {
            const sensitiveEntities = ['app_users', 'role_permissions', 'action_logs', 'db_inspector', 'theme', 'notification_configs'];
            if (sensitiveEntities.includes(tableName as string) && !verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
            
            // SPECIAL HANDLING FOR EVALUATIONS FETCH (Includes Nested Metrics)
            if (tableName === 'resource_evaluations') {
                let queryStr = `SELECT * FROM resource_evaluations`;
                const params = [];
                if (id) { queryStr += ` WHERE id = $1`; params.push(id); }
                else if (resourceId) { queryStr += ` WHERE resource_id = $1`; params.push(resourceId); }
                
                queryStr += ` ORDER BY fiscal_year DESC`;

                const { rows } = await client.query(queryStr, params);
                const evaluations = rows.map(toCamelAndNormalize);
                
                // Fetch metrics efficiently
                const evalIds = evaluations.map((e: any) => e.id);
                if (evalIds.length > 0) {
                     const metricsRes = await client.query(`SELECT * FROM evaluation_metrics WHERE evaluation_id = ANY($1::uuid[])`, [evalIds]);
                     const metrics = metricsRes.rows.map(toCamelAndNormalize);
                     evaluations.forEach((ev: any) => {
                         ev.metrics = metrics.filter((m: any) => m.evaluationId === ev.id);
                     });
                } else {
                    evaluations.forEach((ev: any) => ev.metrics = []);
                }
                
                return res.status(200).json(evaluations);
            }

            let queryStr = `SELECT * FROM ${tableName}`;
            const params = [];
            if (id) { queryStr += ` WHERE id = $1`; params.push(id); }
            const { rows } = await client.query(queryStr, params);
            // Hide password_hash for app_users
            if (tableName === 'app_users') {
                rows.forEach(r => delete r.password_hash);
            }
            return res.status(200).json(id ? (rows[0] ? toCamelAndNormalize(rows[0]) : null) : rows.map(toCamelAndNormalize));
        }

        if (method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });

             // --- SPECIAL BULK POST HANDLERS ---
             
             // Role Permissions Bulk Save (Security Center)
             if (tableName === 'role_permissions') {
                 if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
                 const { permissions } = req.body;
                 if (!permissions || !Array.isArray(permissions)) return res.status(400).json({ error: "Invalid data format. Expected 'permissions' array." });
                 
                 await client.query('BEGIN');
                 for (const p of permissions) {
                     await client.query(`
                        INSERT INTO role_permissions (role, page_path, is_allowed)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (role, page_path) DO UPDATE SET is_allowed = $3
                     `, [p.role, p.pagePath, p.isAllowed]);
                 }
                 await client.query('COMMIT');
                 return res.status(200).json({ success: true });
             }

             // Rate Card Entries Bulk Save
             if (tableName === 'rate_card_entries') {
                 const { entries } = req.body;
                 if (!entries || !Array.isArray(entries)) return res.status(400).json({ error: "Invalid data format. Expected 'entries' array." });
                 
                 await client.query('BEGIN');
                 for (const e of entries) {
                      await client.query(`
                        INSERT INTO rate_card_entries (rate_card_id, resource_id, daily_rate)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (rate_card_id, resource_id) DO UPDATE SET daily_rate = $3
                     `, [e.rateCardId, e.resourceId, e.dailyRate]);
                 }
                 await client.query('COMMIT');
                 return res.status(200).json({ success: true });
             }

             // --- STANDARD SINGLE ENTITY POST ---
             const schema = VALIDATION_SCHEMAS[tableName as string];
             if (!schema) return res.status(400).json({ error: `Not supported: ${entity}` });
             
             // Special handling for app_users creation
             if (tableName === 'app_users') {
                 if (!verifyAdmin(req)) return res.status(403).json({ error: 'Only admins can create users' });
                 const parseResult = schema.safeParse(req.body);
                 if (!parseResult.success) return res.status(400).json({ error: "Invalid data", details: parseResult.error.flatten() });
                 
                 const validatedBody = parseResult.data;
                 // Generate temp password hash
                 const salt = await bcrypt.genSalt(10);
                 // Default password "ChangeMe123!" if not provided (though generic UI doesn't provide it yet)
                 const hashedPassword = await bcrypt.hash("ChangeMe123!", salt);
                 
                 const newId = uuidv4();
                 await client.query(
                     `INSERT INTO app_users (id, username, password_hash, role, resource_id, is_active, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
                     [newId, validatedBody.username, hashedPassword, validatedBody.role, validatedBody.resourceId || null, validatedBody.isActive ?? true]
                 );
                 return res.status(201).json({ id: newId, ...validatedBody });
             }

             const parseResult = schema.safeParse(req.body);
             if (!parseResult.success) return res.status(400).json({ error: "Invalid data", details: parseResult.error.flatten() });
             let validatedBody = parseResult.data as any;
             
             // Extract specialized array fields for relation mapping tables (Skills / Categories) AND Evaluation Metrics
             const { categoryIds, macroCategoryIds, metrics, ...dbFields } = validatedBody;

             const columns = Object.keys(dbFields).map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
             const values = Object.values(dbFields);
             
             if (['resource_skills', 'project_skills', 'contract_projects', 'contract_managers'].includes(tableName as string)) {
                const placeholders = values.map((_, i) => `$${i + 1}`);
                const conflictKeys = tableName === 'resource_skills' ? 'resource_id, skill_id' : 
                                     tableName === 'project_skills' ? 'project_id, skill_id' :
                                     tableName === 'contract_projects' ? 'contract_id, project_id' : 'contract_id, resource_id';
                
                await client.query(`
                    INSERT INTO ${tableName} (${columns.join(', ')}) 
                    VALUES (${placeholders.join(', ')})
                    ON CONFLICT (${conflictKeys}) DO NOTHING
                `, values);
                return res.status(201).json(validatedBody);
             }

             const newId = uuidv4();
             const placeholders = values.map((_, i) => `$${i + 2}`);
             
             // TRANSACTIONAL INSERT FOR EVALUATIONS
             if (tableName === 'resource_evaluations') {
                 await client.query('BEGIN');
                 try {
                     await client.query(`INSERT INTO ${tableName} (id, version, ${columns.join(', ')}) VALUES ($1, 1, ${placeholders.join(', ')})`, [newId, ...values]);
                     
                     if (metrics && Array.isArray(metrics)) {
                         for (const m of metrics) {
                             await client.query(
                                 `INSERT INTO evaluation_metrics (id, evaluation_id, category, metric_key, metric_value, score) VALUES ($1, $2, $3, $4, $5, $6)`,
                                 [uuidv4(), newId, m.category, m.metricKey, m.metricValue || null, m.score || null]
                             );
                         }
                     }
                     await client.query('COMMIT');
                 } catch (e) {
                     await client.query('ROLLBACK');
                     throw e;
                 }
             } else {
                 await client.query(`INSERT INTO ${tableName} (id, version, ${columns.join(', ')}) VALUES ($1, 1, ${placeholders.join(', ')})`, [newId, ...values]);
             }
             
             // Handle Relations for Skills and Categories
             if (tableName === 'skills' && categoryIds && Array.isArray(categoryIds)) {
                 for(const catId of categoryIds) {
                     await client.query(`INSERT INTO skill_skill_category_map (skill_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [newId, catId]);
                 }
             }
             if (tableName === 'skill_categories' && macroCategoryIds && Array.isArray(macroCategoryIds)) {
                 for(const macroId of macroCategoryIds) {
                     await client.query(`INSERT INTO skill_category_macro_map (category_id, macro_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [newId, macroId]);
                 }
             }

             await triggerNotification(client, 'POST', tableName as string, newId, validatedBody);
             return res.status(201).json({ id: newId, version: 1, ...validatedBody });
        }

        if (method === 'PUT') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            
            const { version } = req.body;
            if (version === undefined) return res.status(400).json({ error: "Missing version for optimistic locking" });

            const schema = VALIDATION_SCHEMAS[tableName as string];
            if (!schema) return res.status(400).json({ error: `Not supported: ${entity}` });
            
            const dataToValidate = { ...req.body };
            delete dataToValidate.version; 
            const parseResult = schema.safeParse(dataToValidate);
            if (!parseResult.success) return res.status(400).json({ error: "Invalid data", details: parseResult.error.flatten() });
            let validatedBody = parseResult.data as any;
            
            // Extract relations for update
            const { categoryIds, macroCategoryIds, metrics, ...dbFields } = validatedBody;

            const updates = Object.entries(dbFields).map(([k, v], i) => `${k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = $${i + 1}`);
            const values = Object.values(dbFields);
            
            const oldDataRes = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
            if (oldDataRes.rows.length === 0) return res.status(404).json({ error: "Not found" });

            // TRANSACTIONAL UPDATE FOR EVALUATIONS
            if (tableName === 'resource_evaluations') {
                await client.query('BEGIN');
                try {
                    const result = await client.query(
                        `UPDATE ${tableName} SET ${updates.join(', ')}, version = version + 1 
                         WHERE id = $${values.length + 1} AND version = $${values.length + 2}`, 
                        [...values, id, version]
                    );

                    if (result.rowCount === 0) {
                         await client.query('ROLLBACK');
                         return res.status(409).json({ error: "Conflict: Data modified by another user." });
                    }

                    if (metrics !== undefined) { // Explicitly check undefined to allow partial updates
                        await client.query(`DELETE FROM evaluation_metrics WHERE evaluation_id = $1`, [id]);
                        if (Array.isArray(metrics)) {
                             for (const m of metrics) {
                                 await client.query(
                                     `INSERT INTO evaluation_metrics (id, evaluation_id, category, metric_key, metric_value, score) VALUES ($1, $2, $3, $4, $5, $6)`,
                                     [uuidv4(), id, m.category, m.metricKey, m.metricValue || null, m.score || null]
                                 );
                             }
                        }
                    }
                    await client.query('COMMIT');
                } catch(e) {
                    await client.query('ROLLBACK');
                    throw e;
                }
            } else {
                 const result = await client.query(
                    `UPDATE ${tableName} SET ${updates.join(', ')}, version = version + 1 
                     WHERE id = $${values.length + 1} AND version = $${values.length + 2}`, 
                    [...values, id, version]
                );

                if (result.rowCount === 0) {
                    return res.status(409).json({ error: "Conflict: Data has been modified by another user. Please refresh and try again." });
                }
            }

             // Handle Relations Updates (Full Replace)
             if (tableName === 'skills' && categoryIds !== undefined) {
                 await client.query(`DELETE FROM skill_skill_category_map WHERE skill_id = $1`, [id]);
                 if (Array.isArray(categoryIds)) {
                    for(const catId of categoryIds) {
                        await client.query(`INSERT INTO skill_skill_category_map (skill_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, catId]);
                    }
                 }
             }
             if (tableName === 'skill_categories' && macroCategoryIds !== undefined) {
                 await client.query(`DELETE FROM skill_category_macro_map WHERE category_id = $1`, [id]);
                 if (Array.isArray(macroCategoryIds)) {
                     for(const macroId of macroCategoryIds) {
                         await client.query(`INSERT INTO skill_category_macro_map (category_id, macro_category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, macroId]);
                     }
                 }
             }

            await triggerNotification(client, 'PUT', tableName as string, id as string, validatedBody, toCamelAndNormalize(oldDataRes.rows[0]));
            return res.status(200).json({ id, version: Number(version) + 1, ...validatedBody });
        }

        if (method === 'DELETE') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             
             if (tableName === 'resource_skills') {
                await client.query(`DELETE FROM resource_skills WHERE resource_id = $1 AND skill_id = $2`, [resourceId, skillId]);
             } else if (tableName === 'project_skills') {
                await client.query(`DELETE FROM project_skills WHERE project_id = $1 AND skill_id = $2`, [projectId, skillId]);
             } else if (tableName === 'contract_projects') {
                await client.query(`DELETE FROM contract_projects WHERE contract_id = $1 AND project_id = $2`, [contractId, projectId]);
             } else if (tableName === 'contract_managers') {
                await client.query(`DELETE FROM contract_managers WHERE contract_id = $1 AND resource_id = $2`, [contractId, resourceId]);
             } else {
                await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
             }
             return res.status(204).end();
        }

        return res.status(405).end();
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: (error as Error).message });
    } finally { client.release(); }
}
