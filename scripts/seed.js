// In cima al file, prima di qualsiasi importazione
// Questo permette allo script di funzionare sia con la convenzione di Vercel (POSTGRES_URL)
// sia con quella di Neon (NEON_POSTGRES_URL).
if (process.env.NEON_POSTGRES_URL && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.NEON_POSTGRES_URL;
}

import { createPool } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
 
const db = createPool({
    connectionString: process.env.POSTGRES_URL,
});

function generateSampleData() {
    const currentYear = new Date().getFullYear();
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
    const locations = [
        { id: 'loc1', value: 'Milano' },
        { id: 'loc2', value: 'Roma' },
        { id: 'loc3', value: 'Torino' },
        { id: 'loc4', value: 'Napoli' },
        { id: 'loc5', value: 'Padova' },
        { id: 'loc6', value: 'Trento' },
    ];

    // Calendar Data
    const companyCalendar = [
        { id: 'cal1', name: 'Natale', date: `${currentYear}-12-25`, type: 'NATIONAL_HOLIDAY', location: null },
        { id: 'cal2', name: 'Capodanno', date: `${currentYear + 1}-01-01`, type: 'NATIONAL_HOLIDAY', location: null },
        { id: 'cal3', name: 'Chiusura Estiva', date: `${currentYear}-08-15`, type: 'COMPANY_CLOSURE', location: null },
        { id: 'cal4', name: 'Festa del Patrono (Milano)', date: `${currentYear}-12-07`, type: 'LOCAL_HOLIDAY', location: 'Milano' },
    ];

    // Core Data
    const clients = [
        { id: 'c1', name: 'Acme Corp', sector: 'Tecnologia', contactEmail: 'contact@acme.com' },
        { id: 'c2', name: 'Innovate LLC', sector: 'Finanza', contactEmail: 'finance@innovate.com' },
    ];

    const roles = [
        { id: 'r1', name: 'Junior Developer', seniorityLevel: 'Junior', dailyCost: 300, standardCost: 300, dailyExpenses: 10.5 },
        { id: 'r2', name: 'Senior Developer', seniorityLevel: 'Senior', dailyCost: 500, standardCost: 520, dailyExpenses: 17.5 },
        { id: 'r3', name: 'Tech Lead', seniorityLevel: 'Lead', dailyCost: 650, standardCost: 650, dailyExpenses: 22.75 },
        { id: 'r4', name: 'Project Manager', seniorityLevel: 'Senior', dailyCost: 700, standardCost: 700, dailyExpenses: 24.5 },
    ];

    const resources = [
        { id: 'res1', name: 'Mario Rossi', email: 'm.rossi@example.com', roleId: 'r2', horizontal: 'Web Development', location: 'Milano', hireDate: '2022-01-15', workSeniority: 5, maxStaffingPercentage: 100 },
        { id: 'res2', name: 'Laura Bianchi', email: 'l.bianchi@example.com', roleId: 'r1', horizontal: 'Web Development', location: 'Roma', hireDate: '2023-06-01', workSeniority: 1, maxStaffingPercentage: 50 },
        { id: 'res3', name: 'Paolo Verdi', email: 'p.verdi@example.com', roleId: 'r3', horizontal: 'DevOps', location: 'Milano', hireDate: '2020-03-10', workSeniority: 8, maxStaffingPercentage: 100 },
        { id: 'res4', name: 'Giulia Neri', email: 'g.neri@example.com', roleId: 'r4', horizontal: 'Management', location: 'Torino', hireDate: '2019-09-20', workSeniority: 10, maxStaffingPercentage: 80 },
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

    return { clients, roles, resources, projects, assignments, allocations, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar };
};

async function seedConfigTables(client, horizontals, seniorityLevels, projectStatuses, clientSectors, locations) {
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
    await client.sql`
        CREATE TABLE IF NOT EXISTS locations (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    
    await Promise.all([
        ...horizontals.map(h => client.sql`INSERT INTO horizontals (id, value) VALUES (${h.id}, ${h.value}) ON CONFLICT (id) DO NOTHING;`),
        ...seniorityLevels.map(s => client.sql`INSERT INTO seniority_levels (id, value) VALUES (${s.id}, ${s.value}) ON CONFLICT (id) DO NOTHING;`),
        ...projectStatuses.map(p => client.sql`INSERT INTO project_statuses (id, value) VALUES (${p.id}, ${p.value}) ON CONFLICT (id) DO NOTHING;`),
        ...clientSectors.map(c => client.sql`INSERT INTO client_sectors (id, value) VALUES (${c.id}, ${c.value}) ON CONFLICT (id) DO NOTHING;`),
        ...locations.map(l => client.sql`INSERT INTO locations (id, value) VALUES (${l.id}, ${l.value}) ON CONFLICT (id) DO NOTHING;`)
    ]);

    console.log('Config tables seeded.');
}


async function seedMainTables(client, clients, roles, resources, projects, assignments, allocations, companyCalendar) {
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
    await client.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS standard_cost NUMERIC(10, 2);`;
    await client.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS daily_expenses NUMERIC(10, 2);`;

    await client.sql`
        CREATE TABLE IF NOT EXISTS resources (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            role_id UUID REFERENCES roles(id),
            horizontal VARCHAR(255),
            hire_date DATE,
            work_seniority INT,
            notes TEXT,
            max_staffing_percentage INT DEFAULT 100 NOT NULL
        );
    `;
    await client.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS location VARCHAR(255);`;
    await client.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS max_staffing_percentage INT DEFAULT 100 NOT NULL;`;
    
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
    await client.sql`
        CREATE TABLE IF NOT EXISTS company_calendar (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            date DATE NOT NULL,
            type VARCHAR(50) NOT NULL,
            location VARCHAR(255),
            UNIQUE(date, location)
        );
    `;
     await client.sql`
        CREATE TABLE IF NOT EXISTS wbs_tasks (
            id UUID PRIMARY KEY,
            elemento_wbs VARCHAR(255) NOT NULL UNIQUE,
            descrizione_wbe TEXT,
            client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
            periodo VARCHAR(50),
            ore NUMERIC(10, 2),
            produzione_lorda NUMERIC(12, 2),
            ore_network_italia NUMERIC(10, 2),
            produzione_lorda_network_italia NUMERIC(12, 2),
            perdite NUMERIC(12, 2),
            realisation INT,
            spese_onorari_esterni NUMERIC(12, 2),
            spese_altro NUMERIC(12, 2),
            fatture_onorari NUMERIC(12, 2),
            fatture_spese NUMERIC(12, 2),
            iva NUMERIC(12, 2),
            incassi NUMERIC(12, 2),
            primo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL,
            secondo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL
        );
    `;
     await client.sql`
        CREATE TABLE IF NOT EXISTS resource_requests (
            id UUID PRIMARY KEY,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
            requestor_id UUID REFERENCES resources(id) ON DELETE SET NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            commitment_percentage INT NOT NULL,
            is_urgent BOOLEAN DEFAULT FALSE,
            is_long_term BOOLEAN DEFAULT FALSE,
            is_tech_request BOOLEAN DEFAULT FALSE,
            notes TEXT,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await client.sql`ALTER TABLE resource_requests ADD COLUMN IF NOT EXISTS requestor_id UUID REFERENCES resources(id) ON DELETE SET NULL;`;

    await client.sql`
        CREATE TABLE IF NOT EXISTS interviews (
            id UUID PRIMARY KEY,
            resource_request_id UUID REFERENCES resource_requests(id) ON DELETE SET NULL,
            candidate_name VARCHAR(255) NOT NULL,
            candidate_surname VARCHAR(255) NOT NULL,
            birth_date DATE,
            horizontal VARCHAR(255),
            role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
            cv_summary TEXT,
            interviewers_ids UUID[],
            interview_date DATE,
            feedback VARCHAR(50),
            notes TEXT,
            hiring_status VARCHAR(50),
            entry_date DATE,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;

    await client.sql`
        CREATE TABLE IF NOT EXISTS app_config (
            key VARCHAR(255) PRIMARY KEY,
            value VARCHAR(255) NOT NULL
        );
    `;
     await client.sql`
        INSERT INTO app_config (key, value) 
        VALUES ('login_protection_enabled', 'true') 
        ON CONFLICT (key) DO NOTHING;
    `;

    // --- AUTH SEEDING ---
    await client.sql`
        CREATE TABLE IF NOT EXISTS app_users (
            id UUID PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'SIMPLE',
            resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    // Check if admin exists or seed it
    const usersCheck = await client.sql`SELECT COUNT(*) FROM app_users;`;
    if (usersCheck.rows[0].count === '0') {
        console.log('Seeding default admin user...');
        // Password default: 'admin'
        // Use sync hash for script simplicity or async if top-level await supported.
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync('admin', salt);
        
        await client.sql`
            INSERT INTO app_users (id, username, password_hash, role, is_active)
            VALUES (uuid_generate_v4(), 'admin', ${hash}, 'ADMIN', TRUE);
        `;
        console.log('Default admin created (user: admin, pass: admin)');
    }

    await Promise.all([
        ...clients.map(c => client.sql`INSERT INTO clients (id, name, sector, contact_email) VALUES (${c.id}, ${c.name}, ${c.sector}, ${c.contactEmail}) ON CONFLICT (id) DO NOTHING;`),
        ...roles.map(r => client.sql`INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES (${r.id}, ${r.name}, ${r.seniorityLevel}, ${r.dailyCost}, ${r.standardCost}, ${r.dailyExpenses}) ON CONFLICT (id) DO NOTHING;`)
    ]);

    // Seed resources after roles
    await Promise.all(
         resources.map(res => client.sql`INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes, max_staffing_percentage) VALUES (${res.id}, ${res.name}, ${res.email}, ${res.roleId}, ${res.horizontal}, ${res.location}, ${res.hireDate}, ${res.workSeniority}, ${res.notes}, ${res.maxStaffingPercentage}) ON CONFLICT (id) DO NOTHING;`)
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

    // Seed company calendar
    await Promise.all(
        companyCalendar.map(e => client.sql`
            INSERT INTO company_calendar (id, name, date, type, location)
            VALUES (${e.id}, ${e.name}, ${e.date}, ${e.type}, ${e.location})
            ON CONFLICT (id) DO NOTHING;
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
            sampleData.clientSectors,
            sampleData.locations
        );
        
        await seedMainTables(
            client,
            sampleData.clients,
            sampleData.roles,
            sampleData.resources,
            sampleData.projects,
            sampleData.assignments,
            sampleData.allocations,
            sampleData.companyCalendar
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