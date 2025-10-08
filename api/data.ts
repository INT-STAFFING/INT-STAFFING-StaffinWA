import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption } from '../types';

// Helper function to convert snake_case from DB to camelCase for frontend
const toCamelCase = (obj: any) => {
    const newObj: any = {};
    for (const key in obj) {
        const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
        newObj[newKey] = obj[key];
    }
    return newObj;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    try {
        const [
            clientsRes,
            rolesRes,
            resourcesRes,
            projectsRes,
            assignmentsRes,
            allocationsRes,
            horizontalsRes,
            seniorityLevelsRes,
            projectStatusesRes,
            clientSectorsRes
        ] = await Promise.all([
            db.sql`SELECT * FROM clients;`,
            db.sql`SELECT * FROM roles;`,
            db.sql`SELECT * FROM resources;`,
            db.sql`SELECT * FROM projects;`,
            db.sql`SELECT * FROM assignments;`,
            db.sql`SELECT * FROM allocations;`,
            db.sql`SELECT * FROM horizontals;`,
            db.sql`SELECT * FROM seniority_levels;`,
            db.sql`SELECT * FROM project_statuses;`,
            db.sql`SELECT * FROM client_sectors;`
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

        const data = {
            clients: clientsRes.rows.map(toCamelCase) as Client[],
            roles: rolesRes.rows.map(toCamelCase) as Role[],
            resources: resourcesRes.rows.map(toCamelCase) as Resource[],
            projects: projectsRes.rows.map(toCamelCase) as Project[],
            assignments: assignmentsRes.rows.map(toCamelCase) as Assignment[],
            allocations,
            horizontals: horizontalsRes.rows as ConfigOption[],
            seniorityLevels: seniorityLevelsRes.rows as ConfigOption[],
            projectStatuses: projectStatusesRes.rows as ConfigOption[],
            clientSectors: clientSectorsRes.rows as ConfigOption[],
        };

        return res.status(200).json(data);
    } catch (error) {
        console.error('Failed to fetch all data:', error);
        return res.status(500).json({ error: 'Failed to fetch data' });
    }
}