
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
    'role_permissions': 'role_permissions',
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
    'notifications': 'notifications'
};

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
        overheadPct: z.number().optional(),
        chargeablePct: z.number().optional(),
        trainingPct: z.number().optional(),
        bdPct: z.number().optional()
    }),
    'skills': z.object({
        name: z.string(),
        isCertification: z.boolean().optional().nullable()
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
            // Check if feedback was added/updated
            if (data.feedback && data.feedback !== oldData?.feedback) {
                
                // Calculate Average Rating
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
                        // Beautify key for display
                        const readableKey = key.replace('rating', '').replace(/([A-Z])/g, ' $1').trim();
                        detailedFacts.push({ name: readableKey, value: `${Number(data[key])}/5` });
                    }
                });

                const average = count > 0 ? sum / count : 0;
                const stars = "⭐".repeat(Math.round(average)) + "☆".repeat(5 - Math.round(average));
                
                // Determine Chart Color based on average
                const chartColor = average >= 4 ? '#4caf50' : average >= 3 ? '#ff9800' : '#f44336';
                
                // Construct QuickChart URL for Radial Gauge
                const chartConfig = {
                    type: 'radialGauge',
                    data: {
                        datasets: [{
                            data: [average],
                            backgroundColor: chartColor
                        }]
                    },
                    options: {
                        domain: [0, 5],
                        trackColor: '#e0e0e0',
                        centerPercentage: 80,
                        centerArea: {
                            text: average.toFixed(1),
                            fontColor: chartColor,
                            fontSize: 50,
                            fontFamily: 'Arial',
                            fontWeight: 'bold'
                        }
                    }
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
            }
        }
    } catch (err) { console.error("Notification trigger failed", err); }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action, resourceId, skillId, projectId, contractId } = req.query;
    await ensureDbTablesExist(db);
    const client = await db.connect();
    const currentUser = getUserFromRequest(req);
    const tableName = TABLE_MAPPING[entity as string] || entity;

    try {
        // --- SPECIAL NOTIFICATION HANDLING ---
        if (entity === 'notifications') {
            if (!currentUser) return res.status(401).json({ error: 'Unauthorized' });
            
            // Get Resource ID for the current user
            const { rows: userRows } = await client.query('SELECT resource_id FROM app_users WHERE id = $1', [currentUser.id]);
            const userResourceId = userRows[0]?.resource_id;

            if (!userResourceId && currentUser.role !== 'ADMIN') {
                return res.status(403).json({ error: 'User not linked to a resource.' });
            }

            if (method === 'GET') {
                // If admin, allows seeing all? Usually notifications are personal. 
                // Let's restrict to personal unless explicitly querying for audit (which handles its own query).
                // Or if it's the general notification fetch loop.
                const query = `SELECT * FROM notifications WHERE recipient_resource_id = $1 ORDER BY created_at DESC`;
                const { rows } = await client.query(query, [userResourceId]);
                return res.status(200).json(rows.map(toCamelAndNormalize));
            }

            if (method === 'PUT' && action === 'mark_read') {
                if (id) {
                    // Mark single as read
                    await client.query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_resource_id = $2`, [id, userResourceId]);
                    return res.status(200).json({ success: true });
                } else {
                    // Mark ALL as read for this user
                    await client.query(`UPDATE notifications SET is_read = TRUE WHERE recipient_resource_id = $1`, [userResourceId]);
                    return res.status(200).json({ success: true });
                }
            }
            // Standard handlers below might intervene if we don't return here, but for 'notifications' we usually only GET or PUT(mark_read).
            // Creating notifications is internal.
        }
        // -------------------------------------

        if (method === 'GET') {
            const sensitiveEntities = ['app_users', 'role_permissions', 'action_logs', 'db_inspector', 'theme', 'notification_configs'];
            if (sensitiveEntities.includes(tableName as string) && !verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
            
            let queryStr = `SELECT * FROM ${tableName}`;
            const params = [];
            if (id) { queryStr += ` WHERE id = $1`; params.push(id); }
            const { rows } = await client.query(queryStr, params);
            return res.status(200).json(id ? (rows[0] ? toCamelAndNormalize(rows[0]) : null) : rows.map(toCamelAndNormalize));
        }

        if (method === 'POST') {
             if (!currentUser || !OPERATIONAL_ROLES.includes(currentUser.role)) return res.status(403).json({ error: 'Unauthorized' });
             const schema = VALIDATION_SCHEMAS[tableName as string];
             if (!schema) return res.status(400).json({ error: `Not supported: ${entity}` });
             const parseResult = schema.safeParse(req.body);
             if (!parseResult.success) return res.status(400).json({ error: "Invalid data", details: parseResult.error.flatten() });
             let validatedBody = parseResult.data as any;
             
             const columns = Object.keys(validatedBody).map(k => k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`));
             const values = Object.values(validatedBody);
             
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
             // Initialize version to 1 on create
             await client.query(`INSERT INTO ${tableName} (id, version, ${columns.join(', ')}) VALUES ($1, 1, ${placeholders.join(', ')})`, [newId, ...values]);
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
            delete dataToValidate.version; // Clean version from data update
            const parseResult = schema.safeParse(dataToValidate);
            if (!parseResult.success) return res.status(400).json({ error: "Invalid data", details: parseResult.error.flatten() });
            let validatedBody = parseResult.data as any;
            
            const updates = Object.entries(validatedBody).map(([k, v], i) => `${k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = $${i + 1}`);
            const values = Object.values(validatedBody);
            
            const oldDataRes = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
            if (oldDataRes.rows.length === 0) return res.status(404).json({ error: "Not found" });

            const result = await client.query(
                `UPDATE ${tableName} SET ${updates.join(', ')}, version = version + 1 
                 WHERE id = $${values.length + 1} AND version = $${values.length + 2}`, 
                [...values, id, version]
            );

            if (result.rowCount === 0) {
                return res.status(409).json({ error: "Conflict: Data has been modified by another user. Please refresh and try again." });
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
        return res.status(500).json({ error: (error as Error).message });
    } finally { client.release(); }
}
