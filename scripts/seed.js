const { db } = require('@vercel/postgres');
const { generateSampleData } = require('../utils/sampleData');

async function seedConfigTables(client, horizontals, seniorityLevels, projectStatuses, clientSectors) {
    console.log('Seeding config tables...');
    await client.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

    await client.sql`
        CREATE TABLE IF NOT EXISTS horizontals (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS seniority_levels (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS project_statuses (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS client_sectors (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    
    await Promise.all([
        ...horizontals.map(h => client.sql`INSERT INTO horizontals (id, value) VALUES (${h.id}, ${h.value}) ON CONFLICT (id) DO NOTHING;`),
        ...seniorityLevels.map(s => client.sql`INSERT INTO seniority_levels (id, value) VALUES (${s.id}, ${s.value}) ON CONFLICT (id) DO NOTHING;`),
        ...projectStatuses.map(p => client.sql`INSERT INTO project_statuses (id, value) VALUES (${p.id}, ${p.value}) ON CONFLICT (id) DO NOTHING;`),
        ...clientSectors.map(c => client.sql`INSERT INTO client_sectors (id, value) VALUES (${c.id}, ${c.value}) ON CONFLICT (id) DO NOTHING;`)
    ]);

    console.log('Config tables seeded.');
}


async function seedMainTables(client, clients, roles, resources, projects, assignments, allocations) {
    console.log('Seeding main tables...');

    await client.sql`
        CREATE TABLE IF NOT EXISTS clients (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            sector VARCHAR(255),
            contact_email VARCHAR(255)
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS roles (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            seniority_level VARCHAR(255)
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS resources (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            role_id UUID REFERENCES roles(id),
            horizontal VARCHAR(255),
            hire_date DATE,
            work_seniority INT,
            daily_cost NUMERIC(10, 2),
            notes TEXT
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            client_id UUID REFERENCES clients(id),
            start_date DATE,
            end_date DATE,
            budget NUMERIC(12, 2),
            realization_percentage INT,
            project_manager VARCHAR(255),
            status VARCHAR(100),
            notes TEXT
        );
    `;
     await client.sql`
        CREATE TABLE IF NOT EXISTS assignments (
            id UUID PRIMARY KEY,
            resource_id UUID REFERENCES resources(id),
            project_id UUID REFERENCES projects(id),
            UNIQUE(resource_id, project_id)
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS allocations (
            assignment_id UUID REFERENCES assignments(id),
            allocation_date DATE,
            percentage INT,
            PRIMARY KEY(assignment_id, allocation_date)
        );
    `;

    await Promise.all([
        ...clients.map(c => client.sql`INSERT INTO clients (id, name, sector, contact_email) VALUES (${c.id}, ${c.name}, ${c.sector}, ${c.contactEmail}) ON CONFLICT (id) DO NOTHING;`),
        ...roles.map(r => client.sql`INSERT INTO roles (id, name, seniority_level) VALUES (${r.id}, ${r.name}, ${r.seniorityLevel}) ON CONFLICT (id) DO NOTHING;`),
        ...resources.map(res => client.sql`INSERT INTO resources (id, name, email, role_id, horizontal, hire_date, work_seniority, daily_cost, notes) VALUES (${res.id}, ${res.name}, ${res.email}, ${res.roleId}, ${res.horizontal}, ${res.hireDate}, ${res.workSeniority}, ${res.dailyCost}, ${res.notes}) ON CONFLICT (id) DO NOTHING;`),
        ...projects.map(p => client.sql`INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes) VALUES (${p.id}, ${p.name}, ${p.clientId}, ${p.startDate}, ${p.endDate}, ${p.budget}, ${p.realizationPercentage}, ${p.projectManager}, ${p.status}, ${p.notes}) ON CONFLICT (id) DO NOTHING;`),
        ...assignments.map(a => client.sql`INSERT INTO assignments (id, resource_id, project_id) VALUES (${a.id}, ${a.resourceId}, ${a.projectId}) ON CONFLICT (id) DO NOTHING;`)
    ]);

    const allocationEntries = [];
    for (const assignmentId in allocations) {
        for (const date in allocations[assignmentId]) {
            allocationEntries.push({
                assignmentId,
                date,
                percentage: allocations[assignmentId][date]
            });
        }
    }
    
    await Promise.all(
        allocationEntries.map(a => client.sql`
            INSERT INTO allocations (assignment_id, allocation_date, percentage) 
            VALUES (${a.assignmentId}, ${a.date}, ${a.percentage}) 
            ON CONFLICT (assignment_id, allocation_date) DO NOTHING;
        `)
    );
    
    console.log('Main tables seeded.');
}

async function main() {
    const client = await db.connect();
    const sampleData = generateSampleData();
    
    await seedConfigTables(
        client,
        sampleData.horizontals,
        sampleData.seniorityLevels,
        sampleData.projectStatuses,
        sampleData.clientSectors
    );
    
    await seedMainTables(
        client,
        sampleData.clients,
        sampleData.roles,
        sampleData.resources,
        sampleData.projects,
        sampleData.assignments,
        sampleData.allocations
    );

    await client.release();
}

main().catch((err) => {
    console.error(
        'An error occurred while attempting to seed the database:',
        err,
    );
});
