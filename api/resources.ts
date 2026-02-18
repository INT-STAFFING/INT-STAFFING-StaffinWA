
import { db } from './_lib/db.js';
import { env } from './_lib/env.js';
import { ensureDbTablesExist } from './_lib/schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from '../libs/zod.js';
import { notify } from '../utils/webhookNotifier.js';

const JWT_SECRET = env.JWT_SECRET;

const OPERATIONAL_ROLES = ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];

const verifyAdmin = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return decoded.role === 'ADMIN';
    } catch (e) { return false; }
};

const getUserFromRequest = (req: VercelRequest) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
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
    'notification_rules': 'notification_rules',
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

const VALIDATION_SCHEMAS: Record<string, any> = {
    'resources': z.object({
        name: z.string(),
        email: z.string().optional().nullable(),
        roleId: z.string().optional().nullable(),
        function: z.string().optional().nullable(), // Ridenominato
        industry: z.string().optional().nullable(), // Aggiunto
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
        categoryIds: z.array(z.string()).optional().nullable()
    }),
    'skill_categories': z.object({
        name: z.string(),
        macroCategoryIds: z.array(z.string()).optional().nullable()
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
    'notification_rules': z.object({
        name: z.string(),
        eventType: z.string(),
        webhookUrl: z.string(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
        templateBlocks: z.array(z.object({
            id: z.string(),
            type: z.string(),
            config: z.object({
                titleTemplate: z.string().optional().nullable(),
                subtitleTemplate: z.string().optional().nullable(),
                textTemplate: z.string().optional().nullable(),
                facts: z.array(z.object({ nameTemplate: z.string(), valueTemplate: z.string() })).optional().nullable(),
                imageUrlTemplate: z.string().optional().nullable(),
                imageCaption: z.string().optional().nullable(),
                tableTitle: z.string().optional().nullable(),
                headers: z.array(z.string()).optional().nullable(),
            })
        })).optional(),
        color: z.string().optional().nullable(),
    }),
    'interviews': z.object({
        resourceRequestId: z.string().optional().nullable(),
        candidateName: z.string(),
        candidateSurname: z.string(),
        birthDate: z.string().optional().nullable(),
        function: z.string().optional().nullable(), // renamed from horizontal
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
                 n[camelKey] = value.toISOString();
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
        if (entity === 'db_inspector') {
            if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
            if (action === 'list_tables') {
                const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
                return res.status(200).json(result.rows.map(r => r.table_name));
            }
            if (action === 'get_table_data' && table) {
                const limit = 100;
                const validTablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
                const validTables = validTablesRes.rows.map(r => r.table_name);
                if (!validTables.includes(table as string)) return res.status(400).json({ error: 'Invalid table' });
                const result = await client.query(`SELECT * FROM ${table} LIMIT $1`, [limit]);
                const columns = result.fields.map(f => ({ column_name: f.name, data_type: f.dataTypeID }));
                return res.status(200).json({ columns, rows: result.rows });
            }
        }

        if (entity === 'app-config-batch' && method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             const { updates } = req.body;
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

        if (method === 'GET') {
            const sensitiveEntities = ['app_users', 'role_permissions', 'action_logs', 'db_inspector', 'theme', 'notification_configs', 'notification_rules'];
            if (sensitiveEntities.includes(tableName as string) && !verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
            
            if (tableName === 'resource_evaluations') {
                let queryStr = `SELECT * FROM resource_evaluations`;
                const params = [];
                if (id) { queryStr += ` WHERE id = $1`; params.push(id); }
                else if (resourceId) { queryStr += ` WHERE resource_id = $1`; params.push(resourceId); }
                queryStr += ` ORDER BY fiscal_year DESC`;
                const { rows } = await client.query(queryStr, params);
                const evaluations = rows.map(toCamelAndNormalize);
                const evalIds = evaluations.map((e: any) => e.id);
                if (evalIds.length > 0) {
                     const metricsRes = await client.query(`SELECT * FROM evaluation_metrics WHERE evaluation_id = ANY($1::uuid[])`, [evalIds]);
                     const metrics = metricsRes.rows.map(toCamelAndNormalize);
                     evaluations.forEach((ev: any) => { ev.metrics = metrics.filter((m: any) => m.evaluationId === ev.id); });
                }
                return res.status(200).json(evaluations);
            }

            let queryStr = `SELECT * FROM ${tableName}`;
            const params = [];
            if (id) { queryStr += ` WHERE id = $1`; params.push(id); }
            const { rows } = await client.query(queryStr, params);
            if (tableName === 'app_users') rows.forEach(r => delete r.password_hash);
            return res.status(200).json(id ? (rows[0] ? toCamelAndNormalize(rows[0]) : null) : rows.map(toCamelAndNormalize));
        }

        if (method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             const schema = VALIDATION_SCHEMAS[tableName as string];
             if (!schema) return res.status(400).json({ error: `Not supported: ${entity}` });
             
             if (tableName === 'app_users') {
                 if (!verifyAdmin(req)) return res.status(403).json({ error: 'Only admins can create users' });
                 const parseResult = schema.safeParse(req.body);
                 if (!parseResult.success) return res.status(400).json({ error: "Invalid data" });
                 const validatedBody = parseResult.data;
                 const salt = await bcrypt.genSalt(10);
                 const hashedPassword = await bcrypt.hash("ChangeMe123!", salt);
                 const newId = uuidv4();
                 await client.query(
                     `INSERT INTO app_users (id, username, password_hash, role, resource_id, is_active, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
                     [newId, validatedBody.username, hashedPassword, validatedBody.role, validatedBody.resourceId || null, validatedBody.isActive ?? true]
                 );
                 return res.status(201).json({ id: newId, ...validatedBody });
             }

             const parseResult = schema.safeParse(req.body);
             if (!parseResult.success) return res.status(400).json({ error: "Invalid data" });
             let validatedBody = parseResult.data as any;
             const { categoryIds, macroCategoryIds, metrics, ...dbFields } = validatedBody;
             const columns = Object.keys(dbFields).map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
             const values = Object.values(dbFields);
             const newId = uuidv4();
             const placeholders = values.map((_, i) => `$${i + 2}`);
             await client.query(`INSERT INTO ${tableName} (id, version, ${columns.join(', ')}) VALUES ($1, 1, ${placeholders.join(', ')})`, [newId, ...values]);
             await triggerNotification(client, 'POST', tableName as string, newId, validatedBody);
             return res.status(201).json({ id: newId, version: 1, ...validatedBody });
        }

        if (method === 'PUT') {
            if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
            const { version } = req.body;
            const schema = VALIDATION_SCHEMAS[tableName as string];
            const dataToValidate = { ...req.body };
            delete dataToValidate.version; 
            const parseResult = schema.safeParse(dataToValidate);
            if (!parseResult.success) return res.status(400).json({ error: "Invalid data" });
            let validatedBody = parseResult.data as any;
            const { categoryIds, macroCategoryIds, metrics, ...dbFields } = validatedBody;
            const updates = Object.entries(dbFields).map(([k, v], i) => `${k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = $${i + 1}`);
            const values = Object.values(dbFields);
            const result = await client.query(`UPDATE ${tableName} SET ${updates.join(', ')}, version = version + 1 WHERE id = $${values.length + 1} AND version = $${values.length + 2}`, [...values, id, version]);
            if (result.rowCount === 0) return res.status(409).json({ error: "Conflict" });
            return res.status(200).json({ id, version: Number(version) + 1, ...validatedBody });
        }

        if (method === 'DELETE') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
             return res.status(204).end();
        }

        return res.status(405).end();
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: (error as Error).message });
    } finally { client.release(); }
}