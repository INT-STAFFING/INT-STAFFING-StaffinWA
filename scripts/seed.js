// In cima al file, prima di qualsiasi importazione
// Questo permette allo script di funzionare sia con la convenzione di Vercel (POSTGRES_URL)
// sia con quella di Neon (NEON_POSTGRES_URL).
if (process.env.NEON_POSTGRES_URL && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.NEON_POSTGRES_URL;
}

import { createPool } from '@vercel/postgres';

const db = createPool({
    connectionString: process.env.POSTGRES_URL,
});

function generateSampleData() {
    // Configuration Data
    const horizontals = [
        { id: 'h1', value: 'Web Development' },
        { id: 'h2', value: 'Data Science' },
        { id: 'h3', value: 'DevOps' },
        { id: 'h4', value: 'Design' },
        { id: 'h5', value: 'Management' },
    ];
    const seniorityLevels = [
        { id: 's1', value: 'Junior' },
        { id: 's2', value: 'Mid' },
        { id: 's3', value: 'Senior' },
        { id: 's4', value: 'Lead' },
        { id: 's5', value: 'Manager' },
    ];
    const projectStatuses = [
        { id: 'ps1', value: 'In corso' },
        { id: 'ps2', value: 'Completato' },
        { id: 'ps3', value: 'In pausa' },
    ];
     const clientSectors = [
        { id: 'cs1', value: 'Tecnologia' },
        { id: 'cs2', value: 'Finanza' },
        { id: 'cs3', value: 'Retail' },
        { id: 'cs4', value: 'Sanità' },
    ];

    // Core Data
    const clients = [
        { id: 'c1', name: 'Acme Corp', sector: 'Tecnologia', contactEmail: 'contact@acme.com' },
        { id: 'c2', name: 'Innovate LLC', sector: 'Finanza', contactEmail: 'finance@innovate.com' },
    ];

    const roles = [
        { id: 'r1', name: 'Junior Developer', seniorityLevel: 'Junior', dailyCost: 300 },
        { id: 'r2', name: 'Senior Developer', seniorityLevel: 'Senior', dailyCost: 500 },
        { id: 'r3', name: 'Tech Lead', seniorityLevel: 'Lead', dailyCost: 650 },
        { id: 'r4', name: 'Project Manager', seniorityLevel: 'Senior', dailyCost: 700 },
    ];

    const resources = [
        { id: 'res1', name: 'Mario Rossi', email: 'm.rossi@example.com', roleId: 'r2', horizontal: 'Web Development', hireDate: '2022-01-15', workSeniority: 5 },
        { id: 'res2', name: 'Laura Bianchi', email: 'l.bianchi@example.com', roleId: 'r1', horizontal: 'Web Development', hireDate: '2023-06-01', workSeniority: 1 },
        { id: 'res3', name: 'Paolo Verdi', email: 'p.verdi@example.com', roleId: 'r3', horizontal: 'DevOps', hireDate: '2020-03-10', workSeniority: 8 },
        { id: 'res4', name: 'Giulia Neri', email: 'g.neri@example.com', roleId: 'r4', horizontal: 'Management', hireDate: '2019-09-20', workSeniority: 10 },
    ];

    const projects = [
        { id: 'p1', name: 'E-commerce Platform', clientId: 'c1', startDate: '2024-10-01', endDate: '2024-12-31', budget: 150000, realizationPercentage: 100, projectManager: 'Giulia Neri', status: 'In corso' },
        { id: 'p2', name: 'Mobile Banking App', clientId: 'c2', startDate: '2024-11-01', endDate: '2025-03-31', budget: 250000, realizationPercentage: 90, projectManager: 'Giulia Neri', status: 'In corso' },
        { id: 'p3', name: 'Infrastruttura Cloud', clientId: 'c1', startDate: '2024-09-15', endDate: '2024-11-30', budget: 80000, realizationPercentage: 100, projectManager: 'Paolo Verdi', status: 'Completato' },
    ];

    const assignments = [
        { id: 'as1', resourceId: 'res1', projectId: 'p1' },
        { id: 'as2', resourceId: 'res2', projectId: 'p1' },
        { id: 'as3', resourceId: 'res1', projectId: 'p2' },
        { id: 'as4', resourceId: 'res3', projectId: 'p3' },
        { id: 'as5', resourceId: 'res3', projectId: 'p2' },
    ];

    const allocations = {};
    const today = new Date();
    for (let i = 0; i < 15; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const day = date.getDay();
        if (day !== 0 && day !== 6) { // Skip Sunday and Saturday
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations['as1']) allocations['as1'] = {};
            allocations['as1'][dateStr] = 50;
        }
    }
     for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations['as2']) allocations['as2'] = {};
            allocations['as2'][dateStr] = 100;
        }
    }
     for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const day = date.getDay();
        if (day !== 0 && day !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations['as3']) allocations['as3'] = {};
            allocations['as3'][dateStr] = 60;
        }
    }

    return { clients, roles, resources, projects, assignments, allocations, horizontals, seniorityLevels, projectStatuses, clientSectors };
};

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
            name VARCHAR(255) NOT NULL UNIQUE,
            sector VARCHAR(255),
            contact_email VARCHAR(255)
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS roles (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            seniority_level VARCHAR(255),
            daily_cost NUMERIC(10, 2)
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
            notes TEXT,
            UNIQUE(name, client_id)
        );
    `;
     await client.sql`
        CREATE TABLE IF NOT EXISTS assignments (
            id UUID PRIMARY KEY,
            resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(resource_id, project_id)
        );
    `;
    await client.sql`
        CREATE TABLE IF NOT EXISTS allocations (
            assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
            allocation_date DATE,
            percentage INT,
            PRIMARY KEY(assignment_id, allocation_date)
        );
    `;

    await Promise.all([
        ...clients.map(c => client.sql`INSERT INTO clients (id, name, sector, contact_email) VALUES (${c.id}, ${c.name}, ${c.sector}, ${c.contactEmail}) ON CONFLICT (id) DO NOTHING;`),
        ...roles.map(r => client.sql`INSERT INTO roles (id, name, seniority_level, daily_cost) VALUES (${r.id}, ${r.name}, ${r.seniorityLevel}, ${r.dailyCost}) ON CONFLICT (id) DO NOTHING;`)
    ]);

    // Seed resources after roles
    await Promise.all(
         resources.map(res => client.sql`INSERT INTO resources (id, name, email, role_id, horizontal, hire_date, work_seniority, notes) VALUES (${res.id}, ${res.name}, ${res.email}, ${res.roleId}, ${res.horizontal}, ${res.hireDate}, ${res.workSeniority}, ${res.notes}) ON CONFLICT (id) DO NOTHING;`)
    );
    
    // Seed projects after clients
    await Promise.all(
        projects.map(p => client.sql`INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes) VALUES (${p.id}, ${p.name}, ${p.clientId}, ${p.startDate}, ${p.endDate}, ${p.budget}, ${p.realizationPercentage}, ${p.projectManager}, ${p.status}, ${p.notes}) ON CONFLICT (id) DO NOTHING;`)
    );

    // Seed assignments after resources and projects
    await Promise.all(
        assignments.map(a => client.sql`INSERT INTO assignments (id, resource_id, project_id) VALUES (${a.id}, ${a.resourceId}, ${a.projectId}) ON CONFLICT (id) DO NOTHING;`)
    );


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
    
    // Seed allocations after assignments
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
    
    try {
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
    } catch (err) {
        console.error('Error during seeding:', err);
        throw err;
    } finally {
        await client.release();
    }
}

main().catch((err) => {
    console.error(
        'An error occurred while attempting to seed the database:',
        err,
    );
});