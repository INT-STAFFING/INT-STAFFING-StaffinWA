/**
 * @file api/data.ts
 * @description Endpoint API per il caricamento di tutti i dati iniziali dell'applicazione.
 */

import { db } from './db.js';
import { ensureDbTablesExist } from './schema.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Utility to convert snake_case to camelCase
const toCamelCase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
    }
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
            newObj[newKey] = toCamelCase(obj[key]);
        }
    }
    return newObj;
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        await ensureDbTablesExist(db);

        const [
            clients, roles, resources, projects, assignments,
            horizontals, seniorityLevels, projectStatuses, clientSectors, locations,
            companyCalendar, wbsTasks, resourceRequests, interviews,
            contracts, contractProjects, contractManagers, allocationsResult,
            evaluationsWithAnswers
        ] = await Promise.all([
            db.sql`SELECT * FROM clients ORDER BY name`.then(result => result.rows),
            db.sql`SELECT * FROM roles ORDER BY name`.then(result => result.rows),
            db.sql`SELECT * FROM resources ORDER BY name`.then(result => result.rows),
            db.sql`SELECT * FROM projects ORDER BY name`.then(result => result.rows),
            db.sql`SELECT * FROM assignments`.then(result => result.rows),
            db.sql`SELECT * FROM horizontals ORDER BY value`.then(result => result.rows),
            db.sql`SELECT * FROM seniority_levels ORDER BY value`.then(result => result.rows),
            db.sql`SELECT * FROM project_statuses ORDER BY value`.then(result => result.rows),
            db.sql`SELECT * FROM client_sectors ORDER BY value`.then(result => result.rows),
            db.sql`SELECT * FROM locations ORDER BY value`.then(result => result.rows),
            db.sql`SELECT * FROM company_calendar ORDER BY date`.then(result => result.rows),
            db.sql`SELECT * FROM wbs_tasks ORDER BY elemento_wbs`.then(result => result.rows),
            db.sql`SELECT * FROM resource_requests ORDER BY start_date`.then(result => result.rows),
            db.sql`SELECT * FROM interviews ORDER BY created_at DESC`.then(result => result.rows),
            db.sql`SELECT * FROM contracts ORDER BY name`.then(result => result.rows),
            db.sql`SELECT * FROM contract_projects`.then(result => result.rows),
            db.sql`SELECT * FROM contract_managers`.then(result => result.rows),
            db.sql`SELECT * FROM allocations`.then(result => result.rows),
            db.sql`
                SELECT
                    e.id,
                    e.evaluated_resource_id,
                    e.evaluator_resource_id,
                    e.period,
                    e.created_at,
                    COALESCE(
                        (SELECT json_agg(json_build_object('skillId', ea.skill_id, 'score', ea.score))
                         FROM evaluation_answers ea
                         WHERE ea.evaluation_id = e.id),
                        '[]'::json
                    ) as answers
                FROM evaluations e
            `.then(result => result.rows),
        ]);

        const allocations = allocationsResult.reduce((acc: any, row: any) => {
            const { assignment_id, allocation_date, percentage } = row;
            if (!acc[assignment_id]) {
                acc[assignment_id] = {};
            }
            // Ensure date is in YYYY-MM-DD format without time
            const dateStr = new Date(allocation_date).toISOString().split('T')[0];
            acc[assignment_id][dateStr] = percentage;
            return acc;
        }, {});

        const data = {
            clients: toCamelCase(clients),
            roles: toCamelCase(roles),
            resources: toCamelCase(resources),
            projects: toCamelCase(projects),
            assignments: toCamelCase(assignments),
            allocations,
            horizontals: toCamelCase(horizontals),
            seniorityLevels: toCamelCase(seniorityLevels),
            projectStatuses: toCamelCase(projectStatuses),
            clientSectors: toCamelCase(clientSectors),
            locations: toCamelCase(locations),
            companyCalendar: toCamelCase(companyCalendar),
            wbsTasks: toCamelCase(wbsTasks),
            resourceRequests: toCamelCase(resourceRequests),
            interviews: toCamelCase(interviews),
            evaluations: toCamelCase(evaluationsWithAnswers.map(e => ({...e, answers: e.answers.filter((a: any) => a.skillId !== null)}))),
            contracts: toCamelCase(contracts),
            contractProjects: toCamelCase(contractProjects),
            contractManagers: toCamelCase(contractManagers)
        };

        res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch initial data:', error);
        res.status(500).json({ error: 'Failed to fetch initial application data.', details: (error as Error).message });
    }
}
