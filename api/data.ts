
/**
 * @file api/data.ts
 * @description Endpoint API Dispatcher per recuperare i dati in base allo scope (metadata, planning, all).
 * Supporta il filtraggio temporale per le allocazioni per migliorare le performance.
 */

import { db } from './db.js';
import { ensureDbTablesExist } from './schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent, WbsTask, ResourceRequest, Interview, Contract, Skill, ResourceSkill, ProjectSkill, PageVisibility, RoleCostHistory, LeaveType, LeaveRequest } from '../types';

/**
 * Converte un oggetto con chiavi in snake_case (dal DB) in un oggetto con chiavi in camelCase (per il frontend).
 */
const toCamelCase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
    }
    const newObj: any = {};
    for (const key in obj) {
        const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
        newObj[newKey] = obj[key];
    }
    return newObj;
}

/**
 * Gestore della richiesta API per l'endpoint /api/data.
 * Query Params:
 * - scope: 'metadata' | 'planning' | 'all' (default 'all' per compatibilità)
 * - start: YYYY-MM-DD (solo per scope 'planning', opzionale)
 * - end: YYYY-MM-DD (solo per scope 'planning', opzionale)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const scope = (req.query.scope as string) || 'all';
    const start = req.query.start as string;
    const end = req.query.end as string;

    try {
        // Assicura che lo schema del database esista (solo al primo avvio/seed)
        await ensureDbTablesExist(db);

        const data: any = {};

        // --- METADATA SCOPE (Lightweight) ---
        // Include configurazioni, ruoli, clienti, risorse (anagrafica), skill, calendario
        if (scope === 'metadata' || scope === 'all') {
             const [
                clientsRes,
                rolesRes,
                roleCostHistoryRes,
                resourcesRes,
                horizontalsRes,
                seniorityLevelsRes,
                projectStatusesRes,
                clientSectorsRes,
                locationsRes,
                calendarRes,
                skillsRes,
                resourceSkillsRes,
                pageVisibilityRes,
                skillThresholdsRes,
                projectsRes, // Projects are needed in metadata for some filters
                leaveTypesRes
            ] = await Promise.all([
                db.sql`SELECT * FROM clients;`,
                db.sql`SELECT * FROM roles;`,
                db.sql`SELECT * FROM role_cost_history;`,
                db.sql`SELECT * FROM resources;`,
                db.sql`SELECT * FROM horizontals;`,
                db.sql`SELECT * FROM seniority_levels;`,
                db.sql`SELECT * FROM project_statuses;`,
                db.sql`SELECT * FROM client_sectors;`,
                db.sql`SELECT * FROM locations;`,
                db.sql`SELECT * FROM company_calendar;`,
                db.sql`SELECT * FROM skills;`,
                db.sql`SELECT * FROM resource_skills;`,
                db.sql`SELECT key, value FROM app_config WHERE key LIKE 'page_vis.%';`,
                db.sql`SELECT key, value FROM app_config WHERE key LIKE 'skill_threshold.%';`,
                db.sql`SELECT * FROM projects;`,
                db.sql`SELECT * FROM leave_types;`
            ]);

             // Formatta le date del calendario
            const companyCalendar = calendarRes.rows.map(row => {
                const event = toCamelCase(row);
                if (event.date) {
                    event.date = new Date(event.date).toISOString().split('T')[0];
                }
                return event;
            }) as CalendarEvent[];

            // Mappa visibilità pagine
            const pageVisibility: PageVisibility = {};
            pageVisibilityRes.rows.forEach(row => {
                const path = row.key.replace('page_vis.', '');
                pageVisibility[path] = row.value === 'true';
            });

            // Mappa soglie skills
            const skillThresholds: any = {};
            skillThresholdsRes.rows.forEach(row => {
                const key = row.key.replace('skill_threshold.', '');
                skillThresholds[key] = parseFloat(row.value);
            });

            Object.assign(data, {
                clients: clientsRes.rows.map(toCamelCase) as Client[],
                roles: rolesRes.rows.map(toCamelCase) as Role[],
                roleCostHistory: roleCostHistoryRes.rows.map(row => {
                    const h = toCamelCase(row);
                    if (h.startDate) h.startDate = new Date(h.startDate).toISOString().split('T')[0];
                    if (h.endDate) h.endDate = new Date(h.endDate).toISOString().split('T')[0];
                    return h;
                }) as RoleCostHistory[],
                resources: resourcesRes.rows.map(toCamelCase) as Resource[],
                projects: projectsRes.rows.map(row => {
                    const project = toCamelCase(row);
                    if (project.startDate) project.startDate = new Date(project.startDate).toISOString().split('T')[0];
                    if (project.endDate) project.endDate = new Date(project.endDate).toISOString().split('T')[0];
                    return project;
                }) as Project[],
                horizontals: horizontalsRes.rows as ConfigOption[],
                seniorityLevels: seniorityLevelsRes.rows as ConfigOption[],
                projectStatuses: projectStatusesRes.rows as ConfigOption[],
                clientSectors: clientSectorsRes.rows as ConfigOption[],
                locations: locationsRes.rows as ConfigOption[],
                companyCalendar,
                skills: skillsRes.rows.map(toCamelCase) as Skill[],
                resourceSkills: resourceSkillsRes.rows.map(toCamelCase) as ResourceSkill[],
                pageVisibility,
                skillThresholds,
                leaveTypes: leaveTypesRes.rows.map(toCamelCase) as LeaveType[]
            });
        }

        // --- PLANNING SCOPE (Heavy) ---
        // Include assegnazioni, allocazioni (filtrate), contratti, richieste, wbs
        if (scope === 'planning' || scope === 'all') {
            // Allocations Query Logic
            let allocationsQuery;
            let leaveRequestsQuery;
            if (start && end) {
                // Filtered query
                allocationsQuery = db.query(`SELECT * FROM allocations WHERE allocation_date >= $1 AND allocation_date <= $2`, [start, end]);
                leaveRequestsQuery = db.query(`SELECT * FROM leave_requests WHERE end_date >= $1 AND start_date <= $2`, [start, end]);
            } else {
                // Full load (legacy support)
                allocationsQuery = db.sql`SELECT * FROM allocations;`;
                leaveRequestsQuery = db.sql`SELECT * FROM leave_requests;`;
            }

            const [
                assignmentsRes,
                allocationsRes,
                wbsTasksRes,
                resourceRequestsRes,
                interviewsRes,
                contractsRes,
                contractProjectsRes,
                contractManagersRes,
                projectSkillsRes,
                leaveRequestsRes
            ] = await Promise.all([
                db.sql`SELECT * FROM assignments;`,
                allocationsQuery,
                db.sql`SELECT * FROM wbs_tasks;`,
                db.sql`SELECT * FROM resource_requests;`,
                db.sql`SELECT * FROM interviews;`,
                db.sql`SELECT * FROM contracts;`,
                db.sql`SELECT * FROM contract_projects;`,
                db.sql`SELECT * FROM contract_managers;`,
                db.sql`SELECT * FROM project_skills;`,
                leaveRequestsQuery
            ]);

            const allocations: Allocation = {};
            allocationsRes.rows.forEach(row => {
                const { assignment_id, allocation_date, percentage } = row;
                const dateStr = new Date(allocation_date).toISOString().split('T')[0];
                if (!allocations[assignment_id]) {
                    allocations[assignment_id] = {};
                }
                allocations[assignment_id][dateStr] = percentage;
            });

            Object.assign(data, {
                assignments: assignmentsRes.rows.map(toCamelCase) as Assignment[],
                allocations,
                wbsTasks: wbsTasksRes.rows.map(toCamelCase) as WbsTask[],
                resourceRequests: resourceRequestsRes.rows.map(toCamelCase) as ResourceRequest[],
                interviews: interviewsRes.rows.map(toCamelCase) as Interview[],
                contracts: contractsRes.rows.map(row => {
                    const contract = toCamelCase(row);
                    if (contract.startDate) contract.startDate = new Date(contract.startDate).toISOString().split('T')[0];
                    if (contract.endDate) contract.endDate = new Date(contract.endDate).toISOString().split('T')[0];
                    return contract;
                }) as Contract[],
                contractProjects: contractProjectsRes.rows.map(toCamelCase),
                contractManagers: contractManagersRes.rows.map(toCamelCase),
                projectSkills: projectSkillsRes.rows.map(toCamelCase) as ProjectSkill[],
                leaveRequests: leaveRequestsRes.rows.map(row => {
                    const req = toCamelCase(row);
                    if (req.startDate) req.startDate = new Date(req.startDate).toISOString().split('T')[0];
                    if (req.endDate) req.endDate = new Date(req.endDate).toISOString().split('T')[0];
                    return req;
                }) as LeaveRequest[]
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch data:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
}
