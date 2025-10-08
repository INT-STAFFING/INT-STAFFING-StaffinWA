import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption } from '../types';

export const config = {
  runtime: 'edge',
};

// Helper function to convert snake_case from DB to camelCase for frontend
const toCamelCase = (obj: any) => {
    const newObj: any = {};
    for (const key in obj) {
        const newKey = key.replace(/(_\w)/g, k => k[1].toUpperCase());
        newObj[newKey] = obj[key];
    }
    return newObj;
}

export default async function handler() {
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
            sql`SELECT * FROM clients;`,
            sql`SELECT * FROM roles;`,
            sql`SELECT * FROM resources;`,
            sql`SELECT * FROM projects;`,
            sql`SELECT * FROM assignments;`,
            sql`SELECT * FROM allocations;`,
            sql`SELECT * FROM horizontals;`,
            sql`SELECT * FROM seniority_levels;`,
            sql`SELECT * FROM project_statuses;`,
            sql`SELECT * FROM client_sectors;`
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

        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        console.error('Failed to fetch all data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
