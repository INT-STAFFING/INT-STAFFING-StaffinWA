
import { db } from './_lib/db.js';
import { ensureDbTablesExist } from './_lib/schema.js';
import { verifyAdmin, getUserFromRequest, OPERATIONAL_ROLES } from './_lib/auth.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './_lib/env.js';
import { z } from '../libs/zod.js';
import { notify } from '../utils/webhookNotifier.js';

// Campi che devono essere serializzati come JSON prima di essere passati a PostgreSQL
// (colonne di tipo JSONB — pg driver non serializza automaticamente gli array JS)
const JSONB_FIELDS: Record<string, string[]> = {
    'notification_rules': ['templateBlocks'],
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
    'evaluation_metrics': 'evaluation_metrics',
    'resource_requests': 'resource_requests',
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
    'rate_card_entries': z.object({
        rateCardId: z.string(),
        resourceId: z.string(),
        dailyRate: z.number()
    }),
    'evaluation_metrics': z.object({
        evaluationId: z.string(),
        category: z.string(),
        metricKey: z.string(),
        metricValue: z.string().optional().nullable(),
        score: z.number().optional().nullable()
    }),
    'app_config': z.object({
        key: z.string(),
        value: z.string()
    }),
    'analytics_cache': z.object({
        key: z.string(),
        data: z.any(),
        scope: z.string().optional().nullable()
    }),
    'notifications': z.object({
        recipientResourceId: z.string(),
        title: z.string(),
        message: z.string(),
        link: z.string().optional().nullable(),
        isRead: z.boolean().optional()
    }),
    'role_permissions': z.object({
        role: z.string(),
        pagePath: z.string(),
        isAllowed: z.boolean().optional()
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
    }),
    'resource_requests': z.object({
        projectId: z.string(),
        roleId: z.string(),
        requestorId: z.string().optional().nullable(),
        startDate: z.string(),
        endDate: z.string(),
        commitmentPercentage: z.number(),
        isUrgent: z.boolean().optional(),
        isLongTerm: z.boolean().optional(),
        isTechRequest: z.boolean().optional(),
        isOsrOpen: z.boolean().optional(),
        osrNumber: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        status: z.string(),
    }),
};

const toCamelAndNormalize = (o: any) => {
    if (!o) return {};
    const n: any = {};
    for (const k in o) {
        const camelKey = k.replace(/(_\w)/g, m => m[1].toUpperCase());
        const value = o[k];
        if (value instanceof Date && (camelKey.endsWith('Date') || camelKey === 'date' || camelKey === 'lastDayOfWork' || camelKey === 'updatedAt' || camelKey === 'createdAt')) {
            if (camelKey === 'updatedAt' || camelKey === 'createdAt') {
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
                // Recupera il nome del ruolo invece dell'ID
                let roleName = 'N/A';
                if (data.roleId) {
                    const roleRes = await client.query('SELECT name FROM roles WHERE id = $1', [data.roleId]).catch(() => ({ rows: [] }));
                    roleName = roleRes.rows[0]?.name || data.roleId;
                }
                await notify(client, 'RESOURCE_CREATED', {
                    title: 'Nuova Risorsa Inserita',
                    color: 'Good',
                    facts: [
                        { name: 'Nome', value: data.name },
                        { name: 'Ruolo', value: roleName },
                        { name: 'Funzione', value: data.function || 'N/A' },
                        { name: 'Sede', value: data.location || 'N/A' },
                    ]
                });
            } else if (tableName === 'projects') {
                await notify(client, 'PROJECT_CREATED', {
                    title: 'Nuovo Progetto Creato',
                    color: 'Good',
                    facts: [
                        { name: 'Progetto', value: data.name },
                        { name: 'Budget', value: data.budget ? `${data.budget} €` : 'N/A' },
                        { name: 'Stato', value: data.status || 'N/A' },
                    ]
                });
            } else if (tableName === 'leave_requests') {
                await notify(client, 'LEAVE_REQUEST_CREATED', {
                    title: 'Nuova Richiesta di Assenza',
                    color: 'Accent',
                    facts: [
                        { name: 'Tipo', value: data.leaveType || 'N/A' },
                        { name: 'Dal', value: data.startDate || 'N/A' },
                        { name: 'Al', value: data.endDate || 'N/A' },
                        { name: 'Note', value: data.notes || '' },
                    ]
                });
            } else if (tableName === 'contracts') {
                await notify(client, 'CONTRACT_CREATED', {
                    title: 'Nuovo Contratto Creato',
                    color: 'Good',
                    facts: [
                        { name: 'Contratto', value: data.name },
                        { name: 'CIG', value: data.cig || 'N/A' },
                        { name: 'Capienza', value: data.capienza ? `${data.capienza} €` : 'N/A' },
                    ]
                });
            } else if (tableName === 'resource_skills') {
                await notify(client, 'SKILL_ADDED', {
                    title: 'Nuova Competenza Acquisita',
                    color: 'Good',
                    facts: [
                        { name: 'Livello', value: data.level ? `${data.level}/5` : 'N/A' },
                        { name: 'Data Acquisizione', value: data.acquisitionDate || 'N/A' },
                    ]
                });
            } else if (tableName === 'resource_requests') {
                const requestCode = data.requestCode || '?';
                await notify(client, 'RESOURCE_REQUEST_CREATED', {
                    title: 'Nuova Richiesta Risorsa',
                    color: 'Accent',
                    facts: [
                        { name: 'Codice', value: requestCode },
                        { name: 'Urgenza', value: data.isUrgent ? 'SI' : 'NO' },
                    ]
                });
            }
        } else if (method === 'PUT') {
            if (tableName === 'resources') {
                if (data.resigned === true) {
                    await notify(client, 'RESOURCE_RESIGNED', {
                        title: 'Dimissioni Risorsa',
                        color: 'Warning',
                        facts: [
                            { name: 'Nome', value: data.name || oldData?.name || 'N/A' },
                            { name: 'Ultimo Giorno', value: data.lastDayOfWork || 'N/A' },
                        ]
                    });
                } else {
                    await notify(client, 'RESOURCE_UPDATED', {
                        title: 'Anagrafica Risorsa Aggiornata',
                        color: 'Accent',
                        facts: [
                            { name: 'Nome', value: data.name || oldData?.name || 'N/A' },
                        ]
                    });
                }
            } else if (tableName === 'projects') {
                if (data.status && data.status !== oldData?.status) {
                    await notify(client, 'PROJECT_STATUS_CHANGED', {
                        title: 'Cambio Stato Progetto',
                        color: 'Accent',
                        facts: [
                            { name: 'Progetto', value: data.name || oldData?.name || 'N/A' },
                            { name: 'Precedente', value: oldData?.status || 'N/A' },
                            { name: 'Nuovo Stato', value: data.status },
                        ]
                    });
                } else if (data.budget !== undefined && data.budget !== oldData?.budget) {
                    await notify(client, 'BUDGET_UPDATED', {
                        title: 'Revisione Budget Progetto',
                        color: 'Warning',
                        facts: [
                            { name: 'Progetto', value: data.name || oldData?.name || 'N/A' },
                            { name: 'Budget Precedente', value: oldData?.budget ? `${oldData.budget} €` : 'N/A' },
                            { name: 'Nuovo Budget', value: data.budget ? `${data.budget} €` : 'N/A' },
                        ]
                    });
                }
            } else if (tableName === 'leave_requests') {
                const newStatus = data.status;
                const oldStatus = oldData?.status;
                if (newStatus && newStatus !== oldStatus) {
                    if (newStatus === 'APPROVED') {
                        await notify(client, 'LEAVE_APPROVED', {
                            title: 'Assenza Approvata',
                            color: 'Good',
                            facts: [
                                { name: 'Tipo', value: data.leaveType || oldData?.leaveType || 'N/A' },
                                { name: 'Dal', value: data.startDate || oldData?.startDate || 'N/A' },
                                { name: 'Al', value: data.endDate || oldData?.endDate || 'N/A' },
                            ]
                        });
                    } else if (newStatus === 'REJECTED') {
                        await notify(client, 'LEAVE_REJECTED', {
                            title: 'Assenza Rifiutata',
                            color: 'Attention',
                            facts: [
                                { name: 'Tipo', value: data.leaveType || oldData?.leaveType || 'N/A' },
                                { name: 'Dal', value: data.startDate || oldData?.startDate || 'N/A' },
                                { name: 'Al', value: data.endDate || oldData?.endDate || 'N/A' },
                            ]
                        });
                    }
                }
            } else if (tableName === 'resource_requests') {
                if (data.status && data.status !== oldData?.status) {
                    const code = oldData?.requestCode || '?';
                    await notify(client, 'RESOURCE_REQUEST_STATUS_CHANGED', {
                        title: 'Stato Richiesta Variato',
                        color: 'Accent',
                        facts: [{ name: 'Codice', value: code }, { name: 'Nuovo Stato', value: data.status }]
                    });
                    if (data.requestorId) {
                        await client.query(
                            'INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)',
                            [uuidv4(), data.requestorId, 'Aggiornamento Richiesta', `La tua richiesta ${code} è passata allo stato ${data.status}.`, '/resource-requests']
                        );
                    }
                }
            } else if (tableName === 'interviews') {
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
        }
    } catch (err) { console.error("Notification trigger failed", err); }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action, resourceId, skillId, projectId, contractId, table } = req.query;
    await ensureDbTablesExist(db);
    
    let client;
    try {
        client = await db.connect();
    } catch (error) {
        console.error('DB Connection Error:', error);
        return res.status(500).json({ error: 'Database connection failed' });
    }

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

            if (tableName === 'action_logs') {
                let queryStr = `SELECT * FROM action_logs WHERE 1=1`;
                const params: any[] = [];
                let paramIdx = 1;
                
                const { username, actionType, targetEntity, entityId, startDate, endDate, limit } = req.query;
                
                if (username) { queryStr += ` AND username ILIKE $${paramIdx++}`; params.push(`%${username}%`); }
                if (actionType) { queryStr += ` AND action = $${paramIdx++}`; params.push(actionType); }
                if (targetEntity) { queryStr += ` AND entity = $${paramIdx++}`; params.push(targetEntity); }
                if (entityId) { queryStr += ` AND entity_id = $${paramIdx++}`; params.push(entityId); }
                if (startDate) { queryStr += ` AND created_at >= $${paramIdx++}`; params.push(`${startDate} 00:00:00`); }
                if (endDate) { queryStr += ` AND created_at <= $${paramIdx++}`; params.push(`${endDate} 23:59:59`); }
                
                queryStr += ` ORDER BY created_at DESC LIMIT $${paramIdx}`;
                params.push(limit ? parseInt(limit as string, 10) : 100);
                
                const { rows } = await client.query(queryStr, params);
                return res.status(200).json(rows.map(toCamelAndNormalize));
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
             
             if (entity === 'app-users' && action === 'impersonate') {
                 if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
                 const { rows } = await client.query(`SELECT * FROM app_users WHERE id = $1`, [id]);
                 const targetUser = rows[0];
                 if (!targetUser) return res.status(404).json({ error: 'User not found' });
                 
                 const token = jwt.sign(
                     { userId: targetUser.id, username: targetUser.username, role: targetUser.role },
                     env.JWT_SECRET,
                     { expiresIn: '8h' }
                 );
                 
                 const permRes = await client.query(`SELECT page_path FROM role_permissions WHERE role = $1 AND is_allowed = TRUE`, [targetUser.role]);
                 const permissions = permRes.rows.map(r => r.page_path);
                 
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

             if (entity === 'role-permissions') {
                 if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
                 const { permissions } = req.body;
                 if (!Array.isArray(permissions)) return res.status(400).json({ error: 'Invalid permissions data' });
                 
                 await client.query('BEGIN');
                 await client.query('DELETE FROM role_permissions');
                 for (const p of permissions) {
                     await client.query(
                         `INSERT INTO role_permissions (role, page_path, is_allowed) VALUES ($1, $2, $3)`,
                         [p.role, p.pagePath, p.isAllowed ? true : false]
                     );
                 }
                 await client.query('COMMIT');
                 return res.status(200).json({ success: true });
             }

             if (entity === 'rate_card_entries') {
                 if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
                 const { entries } = req.body;
                 if (!Array.isArray(entries)) return res.status(400).json({ error: 'Invalid entries data' });

                 await client.query('BEGIN');
                 for (const entry of entries) {
                     await client.query(
                         `INSERT INTO rate_card_entries (rate_card_id, resource_id, daily_rate) 
                          VALUES ($1, $2, $3) 
                          ON CONFLICT (rate_card_id, resource_id) DO UPDATE SET daily_rate = $3`,
                         [entry.rateCardId, entry.resourceId, entry.dailyRate]
                     );
                 }
                 await client.query('COMMIT');
                 return res.status(200).json({ success: true });
             }

             // Gestione speciale resource_requests: genera automaticamente il codice HCR
             if (tableName === 'resource_requests') {
                 const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber, notes, status } = req.body;
                 const codeRes = await client.query("SELECT request_code FROM resource_requests WHERE request_code LIKE 'HCR%' ORDER BY LENGTH(request_code) DESC, request_code DESC LIMIT 1");
                 const lastNum = codeRes.rows[0]?.request_code ? parseInt(codeRes.rows[0].request_code.match(/\d+/)?.[0] || '0') : 0;
                 const requestCode = `HCR${String(lastNum + 1).padStart(5, '0')}`;
                 const newId = uuidv4();
                 await client.query(
                     `INSERT INTO resource_requests (id, version, request_code, project_id, role_id, requestor_id, start_date, end_date, commitment_percentage, is_urgent, is_long_term, is_tech_request, is_osr_open, osr_number, notes, status) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                     [newId, requestCode, projectId, roleId, requestorId || null, startDate, endDate, commitmentPercentage, isUrgent ?? false, isLongTerm ?? false, isTechRequest ?? false, isOsrOpen ?? false, osrNumber || null, notes, status]
                 );
                 await triggerNotification(client, 'POST', 'resource_requests', newId, { ...req.body, requestCode });
                 return res.status(201).json({ id: newId, version: 1, requestCode, ...req.body });
             }

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
                 await notify(client, 'USER_CREATED', {
                     title: 'Nuovo Utente di Sistema Creato',
                     color: 'Accent',
                     facts: [{ name: 'Username', value: validatedBody.username }, { name: 'Ruolo', value: validatedBody.role }]
                 });
                 return res.status(201).json({ id: newId, ...validatedBody });
             }

             const parseResult = schema.safeParse(req.body);
             if (!parseResult.success) return res.status(400).json({ error: "Invalid data" });
             let validatedBody = parseResult.data as any;
             const { categoryIds, macroCategoryIds, metrics, ...dbFields } = validatedBody;
             const columns = Object.keys(dbFields).map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
             const jsonbFields = JSONB_FIELDS[tableName as string] || [];
             const values = Object.entries(dbFields).map(([k, v]) =>
                 jsonbFields.includes(k) && typeof v !== 'string' ? JSON.stringify(v) : v
             );
             const newId = uuidv4();
             const placeholders = values.map((_, i) => `$${i + 2}`);
             await client.query(`INSERT INTO ${tableName} (id, version, ${columns.join(', ')}) VALUES ($1, 1, ${placeholders.join(', ')})`, [newId, ...values]);
             await triggerNotification(client, 'POST', tableName as string, newId, validatedBody);
             return res.status(201).json({ id: newId, version: 1, ...validatedBody });
        }

        if (method === 'PUT') {
            if (entity === 'app-users' && action === 'change_password') {
                if (!verifyAdmin(req) && currentUser?.id !== id) return res.status(403).json({ error: 'Forbidden' });
                const { newPassword } = req.body;
                if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Invalid password' });
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(newPassword, salt);
                await client.query(`UPDATE app_users SET password_hash = $1, must_change_password = FALSE WHERE id = $2`, [hashedPassword, id]);
                return res.status(200).json({ success: true });
            }

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
            const jsonbFieldsPut = JSONB_FIELDS[tableName as string] || [];
            const values = Object.entries(dbFields).map(([k, v]) =>
                jsonbFieldsPut.includes(k) && typeof v !== 'string' ? JSON.stringify(v) : v
            );

            // Recupera dati precedenti per confronto nei trigger evento (status change, resigned, ecc.)
            const notifiableTables = ['resources', 'projects', 'leave_requests', 'interviews', 'resource_requests'];
            let oldData: any = null;
            if (id && notifiableTables.includes(tableName as string)) {
                const oldRes = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]).catch(() => ({ rows: [] }));
                if (oldRes.rows[0]) oldData = toCamelAndNormalize(oldRes.rows[0]);
            }

            const result = await client.query(`UPDATE ${tableName} SET ${updates.join(', ')}, version = version + 1 WHERE id = $${values.length + 1} AND version = $${values.length + 2}`, [...values, id, version]);
            if (result.rowCount === 0) return res.status(409).json({ error: "Conflict" });

            await triggerNotification(client, 'PUT', tableName as string, id as string, validatedBody, oldData);

            return res.status(200).json({ id, version: Number(version) + 1, ...validatedBody });
        }

        if (method === 'DELETE') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });

             // Composite-key delete for join tables (no id column)
             if (tableName === 'contract_projects' && req.query.contractId && req.query.projectId) {
                 await client.query(`DELETE FROM contract_projects WHERE contract_id = $1 AND project_id = $2`, [req.query.contractId, req.query.projectId]);
                 return res.status(204).end();
             }
             if (tableName === 'contract_managers' && req.query.contractId && req.query.resourceId) {
                 await client.query(`DELETE FROM contract_managers WHERE contract_id = $1 AND resource_id = $2`, [req.query.contractId, req.query.resourceId]);
                 return res.status(204).end();
             }

             await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
             return res.status(204).end();
        }

        return res.status(405).end();
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: (error as Error).message });
    } finally { 
        if (client) client.release(); 
    }
}