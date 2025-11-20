
/**
 * @file api/data.ts
 * @description Endpoint API per recuperare tutti i dati iniziali necessari all'applicazione con una singola richiesta.
 */

import { db } from './db.js';
import { ensureDbTablesExist } from './schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
// Fix: Import WbsTask type
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption, CalendarEvent, WbsTask, ResourceRequest, Interview, Contract, Skill, ResourceSkill, ProjectSkill, PageVisibility, RoleCostHistory } from '../types';

/**
 * Converte un oggetto con chiavi in snake_case (dal DB) in un oggetto con chiavi in camelCase (per il frontend).
 * @param {any} obj - L'oggetto da convertire.
 * @returns {any} Il nuovo oggetto con chiavi in camelCase.
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
 * Risponde solo a richieste GET.
 * Assicura che le tabelle del database esistano, poi recupera e restituisce tutti i dati necessari.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    try {
        // Assicura che lo schema del database sia creato prima di recuperare i dati.
        // Questo rende l'app resiliente a database vuoti su nuovi deployment.
        await ensureDbTablesExist(db);

        // Esegue tutte le query in parallelo per efficienza.
        const [
            clientsRes,
            rolesRes,
            roleCostHistoryRes,
            resourcesRes,
            projectsRes,
            assignmentsRes,
            allocationsRes,
            horizontalsRes,
            seniorityLevelsRes,
            projectStatusesRes,
            clientSectorsRes,
            locationsRes,
            calendarRes,
            // Fix: Fetch WBS tasks
            wbsTasksRes,
            resourceRequestsRes,
            interviewsRes,
            contractsRes,
            contractProjectsRes,
            contractManagersRes,
            skillsRes,
            resourceSkillsRes,
            projectSkillsRes,
            pageVisibilityRes
        ] = await Promise.all([
            db.sql`SELECT * FROM clients;`,
            db.sql`SELECT * FROM roles;`,
            db.sql`SELECT * FROM role_cost_history;`,
            db.sql`SELECT * FROM resources;`,
            db.sql`SELECT * FROM projects;`,
            db.sql`SELECT * FROM assignments;`,
            db.sql`SELECT * FROM allocations;`,
            db.sql`SELECT * FROM horizontals;`,
            db.sql`SELECT * FROM seniority_levels;`,
            db.sql`SELECT * FROM project_statuses;`,
            db.sql`SELECT * FROM client_sectors;`,
            db.sql`SELECT * FROM locations;`,
            db.sql`SELECT * FROM company_calendar;`,
            // Fix: Fetch WBS tasks
            db.sql`SELECT * FROM wbs_tasks;`,
            db.sql`SELECT * FROM resource_requests;`,
            db.sql`SELECT * FROM interviews;`,
            db.sql`SELECT * FROM contracts;`,
            db.sql`SELECT * FROM contract_projects;`,
            db.sql`SELECT * FROM contract_managers;`,
            db.sql`SELECT * FROM skills;`,
            db.sql`SELECT * FROM resource_skills;`,
            db.sql`SELECT * FROM project_skills;`,
            db.sql`SELECT key, value FROM app_config WHERE key LIKE 'page_vis.%';`
        ]);

        // Trasforma la lista di allocazioni dal formato tabellare del DB
        // al formato annidato { assignmentId: { date: percentage } } usato dal frontend.
        const allocations: Allocation = {};
        allocationsRes.rows.forEach(row => {
            const { assignment_id, allocation_date, percentage } = row;
            const dateStr = new Date(allocation_date).toISOString().split('T')[0];
            if (!allocations[assignment_id]) {
                allocations[assignment_id] = {};
            }
            allocations[assignment_id][dateStr] = percentage;
        });

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


        // Assembla l'oggetto dati finale, convertendo i nomi delle colonne in camelCase.
        const data = {
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
            assignments: assignmentsRes.rows.map(toCamelCase) as Assignment[],
            allocations,
            horizontals: horizontalsRes.rows as ConfigOption[],
            seniorityLevels: seniorityLevelsRes.rows as ConfigOption[],
            projectStatuses: projectStatusesRes.rows as ConfigOption[],
            clientSectors: clientSectorsRes.rows as ConfigOption[],
            locations: locationsRes.rows as ConfigOption[],
            companyCalendar,
            // Fix: Add wbsTasks to the response
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
            skills: skillsRes.rows.map(toCamelCase) as Skill[],
            resourceSkills: resourceSkillsRes.rows.map(toCamelCase) as ResourceSkill[],
            projectSkills: projectSkillsRes.rows.map(toCamelCase) as ProjectSkill[],
            pageVisibility
        };

        return res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch all data:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
}