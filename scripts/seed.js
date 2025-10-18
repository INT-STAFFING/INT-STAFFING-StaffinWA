// In cima al file, prima di qualsiasi importazione
// Questo permette allo script di funzionare sia con la convenzione di Vercel (POSTGRES_URL)
// sia con quella di Neon (NEON_POSTGRES_URL).
if (process.env.NEON_POSTGRES_URL && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.NEON_POSTGRES_URL;
}

import { createPool } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid'; // Used only for new entities if needed

const db = createPool({
    connectionString: process.env.POSTGRES_URL,
});

function generateSampleData() {
    const currentYear = new Date().getFullYear();
    // Configuration Data
    const horizontals = [
        { id: uuidv4(), value: 'Web Development' }, { id: uuidv4(), value: 'Data Science' },
        { id: uuidv4(), value: 'DevOps' }, { id: uuidv4(), value: 'Design' }, { id: uuidv4(), value: 'Management' },
    ];
    const seniorityLevels = [
        { id: uuidv4(), value: 'Junior' }, { id: uuidv4(), value: 'Mid' }, { id: uuidv4(), value: 'Senior' },
        { id: uuidv4(), value: 'Lead' }, { id: uuidv4(), value: 'Manager' },
    ];
    const projectStatuses = [
        { id: uuidv4(), value: 'In corso' }, { id: uuidv4(), value: 'Completato' }, { id: uuidv4(), value: 'In pausa' },
    ];
     const clientSectors = [
        { id: uuidv4(), value: 'Tecnologia' }, { id: uuidv4(), value: 'Finanza' },
        { id: uuidv4(), value: 'Retail' }, { id: uuidv4(), value: 'Sanità' },
    ];
    const locations = [
        { id: uuidv4(), value: 'Milano' }, { id: uuidv4(), value: 'Roma' }, { id: uuidv4(), value: 'Torino' },
        { id: uuidv4(), value: 'Napoli' }, { id: uuidv4(), value: 'Padova' }, { id: uuidv4(), value: 'Trento' },
    ];

    // Calendar Data
    const companyCalendar = [
        { id: uuidv4(), name: 'Natale', date: `${currentYear}-12-25`, type: 'NATIONAL_HOLIDAY', location: null },
        { id: uuidv4(), name: 'Capodanno', date: `${currentYear + 1}-01-01`, type: 'NATIONAL_HOLIDAY', location: null },
        { id: uuidv4(), name: 'Chiusura Estiva', date: `${currentYear}-08-15`, type: 'COMPANY_CLOSURE', location: null },
        { id: uuidv4(), name: 'Festa del Patrono (Milano)', date: `${currentYear}-12-07`, type: 'LOCAL_HOLIDAY', location: 'Milano' },
    ];

    // Core Data
    const clientIds = { c1: uuidv4(), c2: uuidv4() };
    const clients = [
        { id: clientIds.c1, name: 'Acme Corp', sector: 'Tecnologia', contactEmail: 'contact@acme.com' },
        { id: clientIds.c2, name: 'Innovate LLC', sector: 'Finanza', contactEmail: 'finance@innovate.com' },
    ];

    const roleIds = { r1: uuidv4(), r2: uuidv4(), r3: uuidv4(), r4: uuidv4() };
    const roles = [
        { id: roleIds.r1, name: 'Junior Developer', seniorityLevel: 'Junior', dailyCost: 300, standardCost: 300, dailyExpenses: 10.5 },
        { id: roleIds.r2, name: 'Senior Developer', seniorityLevel: 'Senior', dailyCost: 500, standardCost: 520, dailyExpenses: 17.5 },
        { id: roleIds.r3, name: 'Tech Lead', seniorityLevel: 'Lead', dailyCost: 650, standardCost: 650, dailyExpenses: 22.75 },
        { id: roleIds.r4, name: 'Project Manager', seniorityLevel: 'Senior', dailyCost: 700, standardCost: 700, dailyExpenses: 24.5 },
    ];

    const resourceIds = { res1: uuidv4(), res2: uuidv4(), res3: uuidv4(), res4: uuidv4() };
    const resources = [
        { id: resourceIds.res1, name: 'Mario Rossi', email: 'm.rossi@example.com', roleId: roleIds.r2, horizontal: 'Web Development', location: 'Milano', hireDate: '2022-01-15', workSeniority: 5, maxStaffingPercentage: 100, notes: '' },
        { id: resourceIds.res2, name: 'Laura Bianchi', email: 'l.bianchi@example.com', roleId: roleIds.r1, horizontal: 'Web Development', location: 'Roma', hireDate: '2023-06-01', workSeniority: 1, maxStaffingPercentage: 50, notes: '' },
        { id: resourceIds.res3, name: 'Paolo Verdi', email: 'p.verdi@example.com', roleId: roleIds.r3, horizontal: 'DevOps', location: 'Milano', hireDate: '2020-03-10', workSeniority: 8, maxStaffingPercentage: 100, notes: '' },
        { id: resourceIds.res4, name: 'Giulia Neri', email: 'g.neri@example.com', roleId: roleIds.r4, horizontal: 'Management', location: 'Torino', hireDate: '2019-09-20', workSeniority: 10, maxStaffingPercentage: 80, notes: '' },
    ];

    const projectIds = { p1: uuidv4(), p2: uuidv4(), p3: uuidv4() };
    const projects = [
        { id: projectIds.p1, name: 'E-commerce Platform', clientId: clientIds.c1, startDate: '2024-10-01', endDate: '2024-12-31', budget: 150000, realizationPercentage: 100, projectManager: 'Giulia Neri', status: 'In corso', notes: '' },
        { id: projectIds.p2, name: 'Mobile Banking App', clientId: clientIds.c2, startDate: '2024-11-01', endDate: '2025-03-31', budget: 250000, realizationPercentage: 90, projectManager: 'Giulia Neri', status: 'In corso', notes: '' },
        { id: projectIds.p3, name: 'Infrastruttura Cloud', clientId: clientIds.c1, startDate: '2024-09-15', endDate: '2024-11-30', budget: 80000, realizationPercentage: 100, projectManager: 'Paolo Verdi', status: 'Completato', notes: '' },
    ];

    const assignmentIds = { as1: uuidv4(), as2: uuidv4(), as3: uuidv4(), as4: uuidv4(), as5: uuidv4() };
    const assignments = [
        { id: assignmentIds.as1, resourceId: resourceIds.res1, projectId: projectIds.p1 },
        { id: assignmentIds.as2, resourceId: resourceIds.res2, projectId: projectIds.p1 },
        { id: assignmentIds.as3, resourceId: resourceIds.res1, projectId: projectIds.p2 },
        { id: assignmentIds.as4, resourceId: resourceIds.res3, projectId: projectIds.p3 },
        { id: assignmentIds.as5, resourceId: resourceIds.res3, projectId: projectIds.p2 },
    ];

    const candidates = [
        { id: uuidv4(), firstName: 'Marco', lastName: 'Gialli', birthYear: 1998, horizontal: 'Web Development', roleId: roleIds.r1, cvSummary: 'Neolaureato con esperienza in React.', interviewers: [resourceIds.res1], nextInterviewDate: `${currentYear}-10-25`, interviewFeedback: 'Positivo', notes: 'Molto promettente.', entryDate: null, status: 'Aperto', pipelineStatus: 'Colloquio Tecnico' },
        { id: uuidv4(), firstName: 'Serena', lastName: 'Azzurri', birthYear: 1995, horizontal: 'Design', roleId: null, cvSummary: 'Designer UX/UI con 4 anni di esperienza.', interviewers: [], nextInterviewDate: null, interviewFeedback: null, notes: '', entryDate: null, status: 'Aperto', pipelineStatus: 'Candidature Ricevute e screening CV' }
    ];

    const allocations = {};
    const today = new Date();
    for (let i = 0; i < 15; i++) {
        const date = new Date(); date.setDate(today.getDate() + i);
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations[assignmentIds.as1]) allocations[assignmentIds.as1] = {};
            allocations[assignmentIds.as1][dateStr] = 50;
        }
    }
    for (let i = 0; i < 10; i++) {
        const date = new Date(); date.setDate(today.getDate() + i);
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations[assignmentIds.as2]) allocations[assignmentIds.as2] = {};
            allocations[assignmentIds.as2][dateStr] = 100;
        }
    }
    for (let i = 0; i < 5; i++) {
        const date = new Date(); date.setDate(today.getDate() + i);
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            const dateStr = date.toISOString().split('T')[0];
            if (!allocations[assignmentIds.as3]) allocations[assignmentIds.as3] = {};
            allocations[assignmentIds.as3][dateStr] = 60;
        }
    }

    return { clients, roles, resources, projects, assignments, allocations, horizontals, seniorityLevels, projectStatuses, clientSectors, locations, companyCalendar, candidates };
};

async function seedConfigTables(client, horizontals, seniorityLevels, projectStatuses, clientSectors, locations) {
    console.log('Seeding config tables...');
    await client.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

    await client.sql`CREATE TABLE IF NOT EXISTS horizontals (id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE);`;
    await client.sql`CREATE TABLE IF NOT EXISTS seniority_levels (id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE);`;
    await client.sql`CREATE TABLE IF NOT EXISTS project_statuses (id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE);`;
    await client.sql`CREATE TABLE IF NOT EXISTS client_sectors (id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE);`;
    await client.sql`CREATE TABLE IF NOT EXISTS locations (id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE);`;
    
    await Promise.all([
        ...horizontals.map(h => client.sql`INSERT INTO horizontals (id, value) VALUES (${h.id}, ${h.value}) ON CONFLICT (id) DO NOTHING;`),
        ...seniorityLevels.map(s => client.sql`INSERT INTO seniority_levels (id, value) VALUES (${s.id}, ${s.value}) ON CONFLICT (id) DO NOTHING;`),
        ...projectStatuses.map(p => client.sql`INSERT INTO project_statuses (id, value) VALUES (${p.id}, ${p.value}) ON CONFLICT (id) DO NOTHING;`),
        ...clientSectors.map(c => client.sql`INSERT INTO client_sectors (id, value) VALUES (${c.id}, ${c.value}) ON CONFLICT (id) DO NOTHING;`),
        ...locations.map(l => client.sql`INSERT INTO locations (id, value) VALUES (${l.id}, ${l.value}) ON CONFLICT (id) DO NOTHING;`)
    ]);

    console.log('Config tables seeded.');
}


async function seedMainTables(client, clients, roles, resources, projects, assignments, allocations, companyCalendar, candidates) {
    console.log('Seeding main tables...');

    await client.sql`CREATE TABLE IF NOT EXISTS clients (id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, sector VARCHAR(255), contact_email VARCHAR(255));`;
    await client.sql`CREATE TABLE IF NOT EXISTS roles (id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, seniority_level VARCHAR(255), daily_cost NUMERIC(10, 2));`;
    await client.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS standard_cost NUMERIC(10, 2);`;
    await client.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS daily_expenses NUMERIC(10, 2);`;
    await client.sql`CREATE TABLE IF NOT EXISTS resources (id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE, role_id UUID REFERENCES roles(id), horizontal VARCHAR(255), hire_date DATE, work_seniority INT, notes TEXT);`;
    await client.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS location VARCHAR(255);`;
    await client.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS max_staffing_percentage INT DEFAULT 100 NOT NULL;`;
    await client.sql`CREATE TABLE IF NOT EXISTS projects (id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, client_id UUID REFERENCES clients(id), start_date DATE, end_date DATE, budget NUMERIC(12, 2), realization_percentage INT, project_manager VARCHAR(255), status VARCHAR(100), notes TEXT, UNIQUE(name, client_id));`;
    await client.sql`CREATE TABLE IF NOT EXISTS assignments (id UUID PRIMARY KEY, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, UNIQUE(resource_id, project_id));`;
    await client.sql`CREATE TABLE IF NOT EXISTS allocations (assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE, allocation_date DATE, percentage INT, PRIMARY KEY(assignment_id, allocation_date));`;
    await client.sql`CREATE TABLE IF NOT EXISTS company_calendar (id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, date DATE NOT NULL, type VARCHAR(50) NOT NULL, location VARCHAR(255), UNIQUE(date, location));`;
    await client.sql`CREATE TABLE IF NOT EXISTS candidates (id UUID PRIMARY KEY, first_name VARCHAR(255) NOT NULL, last_name VARCHAR(255) NOT NULL, birth_year INT, horizontal VARCHAR(255), role_id UUID REFERENCES roles(id) ON DELETE SET NULL, cv_summary TEXT, interviewers UUID[], next_interview_date DATE, interview_feedback VARCHAR(50), notes TEXT, entry_date DATE, status VARCHAR(50), pipeline_status VARCHAR(100) NOT NULL);`;

    await Promise.all([
        ...clients.map(c => client.sql`INSERT INTO clients (id, name, sector, contact_email) VALUES (${c.id}, ${c.name}, ${c.sector}, ${c.contactEmail}) ON CONFLICT (id) DO NOTHING;`),
        ...roles.map(r => client.sql`INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES (${r.id}, ${r.name}, ${r.seniorityLevel}, ${r.dailyCost}, ${r.standardCost}, ${r.dailyExpenses}) ON CONFLICT (id) DO NOTHING;`)
    ]);
    await Promise.all(
         resources.map(res => client.sql`INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes, max_staffing_percentage) VALUES (${res.id}, ${res.name}, ${res.email}, ${res.roleId}, ${res.horizontal}, ${res.location}, ${res.hireDate}, ${res.workSeniority}, ${res.notes}, ${res.maxStaffingPercentage}) ON CONFLICT (id) DO NOTHING;`)
    );
    await Promise.all(
        projects.map(p => client.sql`INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes) VALUES (${p.id}, ${p.name}, ${p.clientId}, ${p.startDate}, ${p.endDate}, ${p.budget}, ${p.realizationPercentage}, ${p.projectManager}, ${p.status}, ${p.notes}) ON CONFLICT (id) DO NOTHING;`)
    );
    await Promise.all(
        assignments.map(a => client.sql`INSERT INTO assignments (id, resource_id, project_id) VALUES (${a.id}, ${a.resourceId}, ${a.projectId}) ON CONFLICT (id) DO NOTHING;`)
    );
    const allocationEntries = [];
    for (const assignmentId in allocations) {
        for (const date in allocations[assignmentId]) {
            allocationEntries.push({ assignmentId, date, percentage: allocations[assignmentId][date] });
        }
    }
    await Promise.all(
        allocationEntries.map(a => client.sql`INSERT INTO allocations (assignment_id, allocation_date, percentage) VALUES (${a.assignmentId}, ${a.date}, ${a.percentage}) ON CONFLICT (assignment_id, allocation_date) DO NOTHING;`)
    );
    await Promise.all(
        companyCalendar.map(e => client.sql`INSERT INTO company_calendar (id, name, date, type, location) VALUES (${e.id}, ${e.name}, ${e.date}, ${e.type}, ${e.location}) ON CONFLICT (id) DO NOTHING;`)
    );
    await Promise.all(
        candidates.map(c => client.sql`
            INSERT INTO candidates (id, first_name, last_name, birth_year, horizontal, role_id, cv_summary, interviewers, next_interview_date, interview_feedback, notes, entry_date, status, pipeline_status)
            VALUES (${c.id}, ${c.firstName}, ${c.lastName}, ${c.birthYear}, ${c.horizontal}, ${c.roleId}, ${c.cvSummary}, ${c.interviewers.length > 0 ? c.interviewers : null}, ${c.nextInterviewDate}, ${c.interviewFeedback}, ${c.notes}, ${c.entryDate}, ${c.status}, ${c.pipelineStatus})
            ON CONFLICT (id) DO NOTHING;
        `)
    );
    
    console.log('Main tables seeded.');
}

async function main() {
    const client = await db.connect();
    const sampleData = generateSampleData();
    
    try {
        await seedConfigTables(client, sampleData.horizontals, sampleData.seniorityLevels, sampleData.projectStatuses, sampleData.clientSectors, sampleData.locations);
        await seedMainTables(client, sampleData.clients, sampleData.roles, sampleData.resources, sampleData.projects, sampleData.assignments, sampleData.allocations, sampleData.companyCalendar, sampleData.candidates);
    } catch (err) {
        console.error('Error during seeding:', err);
        throw err;
    } finally {
        await client.release();
    }
}

main().catch((err) => {
    console.error('An error occurred while attempting to seed the database:', err);
});