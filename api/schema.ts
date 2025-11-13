import type { VercelPool } from '@vercel/postgres';

export async function ensureDbTablesExist(db: VercelPool) {
    // This function is idempotent, thanks to "IF NOT EXISTS".
    // It can be safely called on every API request without performance issues on subsequent calls.
    await db.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

    // Configuration Tables
    await db.sql`
        CREATE TABLE IF NOT EXISTS horizontals (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    await db.sql`
        CREATE TABLE IF NOT EXISTS seniority_levels (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    await db.sql`
        CREATE TABLE IF NOT EXISTS project_statuses (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
    await db.sql`
        CREATE TABLE IF NOT EXISTS client_sectors (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;
     await db.sql`
        CREATE TABLE IF NOT EXISTS locations (
            id UUID PRIMARY KEY,
            value VARCHAR(255) NOT NULL UNIQUE
        );
    `;

    // Core Data Tables
    await db.sql`
        CREATE TABLE IF NOT EXISTS clients (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            sector VARCHAR(255),
            contact_email VARCHAR(255)
        );
    `;
    await db.sql`
        CREATE TABLE IF NOT EXISTS roles (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            seniority_level VARCHAR(255),
            daily_cost NUMERIC(10, 2),
            standard_cost NUMERIC(10, 2),
            daily_expenses NUMERIC(10, 2)
        );
    `;
     // Add columns if they don't exist to handle migration for existing databases.
    await db.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS standard_cost NUMERIC(10, 2);`;
    await db.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS daily_expenses NUMERIC(10, 2);`;
    
    await db.sql`
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
    // Add columns if they don't exist to handle migration for existing databases.
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS location VARCHAR(255);`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS max_staffing_percentage INT DEFAULT 100 NOT NULL;`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS resigned BOOLEAN DEFAULT FALSE;`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS last_day_of_work DATE;`;


    await db.sql`
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

    // New Contract Tables
    await db.sql`
        CREATE TABLE IF NOT EXISTS contracts (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            start_date DATE,
            end_date DATE,
            cig VARCHAR(255) NOT NULL,
            cig_derivato VARCHAR(255),
            capienza NUMERIC(15, 2) NOT NULL,
            backlog NUMERIC(15, 2) DEFAULT 0,
            UNIQUE(name),
            UNIQUE(cig)
        );
    `;
    await db.sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS backlog NUMERIC(15, 2) DEFAULT 0;`;

     await db.sql`
        CREATE TABLE IF NOT EXISTS contract_projects (
            contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            PRIMARY KEY (contract_id, project_id)
        );
    `;
     await db.sql`
        CREATE TABLE IF NOT EXISTS contract_managers (
            contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
            resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
            PRIMARY KEY (contract_id, resource_id)
        );
    `;
    
    // Add contract_id to projects table
    await db.sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;`;


    await db.sql`
        CREATE TABLE IF NOT EXISTS assignments (
            id UUID PRIMARY KEY,
            resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(resource_id, project_id)
        );
    `;
    await db.sql`
        CREATE TABLE IF NOT EXISTS allocations (
            assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
            allocation_date DATE,
            percentage INT,
            PRIMARY KEY(assignment_id, allocation_date)
        );
    `;
     await db.sql`
        CREATE TABLE IF NOT EXISTS company_calendar (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            date DATE NOT NULL,
            type VARCHAR(50) NOT NULL,
            location VARCHAR(255),
            UNIQUE(date, location)
        );
    `;
    await db.sql`
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
    await db.sql`
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
    await db.sql`ALTER TABLE resource_requests ADD COLUMN IF NOT EXISTS requestor_id UUID REFERENCES resources(id) ON DELETE SET NULL;`;
    await db.sql`ALTER TABLE resource_requests ADD COLUMN IF NOT EXISTS request_code TEXT UNIQUE;`;


    // New Interviews Table
    await db.sql`
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

    // Application Configuration Table
    await db.sql`
        CREATE TABLE IF NOT EXISTS app_config (
            key VARCHAR(255) PRIMARY KEY,
            value VARCHAR(255) NOT NULL
        );
    `;

    // Backfill request_code for existing resource_requests
    const backfillClient = await db.connect();
    try {
        await backfillClient.query('BEGIN');
        // Check if backfill is needed
        const needsBackfillRes = await backfillClient.query(`SELECT id FROM resource_requests WHERE request_code IS NULL LIMIT 1;`);
        if (needsBackfillRes.rows.length > 0) {
            console.log('Backfilling request_code for resource_requests...');
            // Get the last used code number
            const lastCodeRes = await backfillClient.query(`SELECT request_code FROM resource_requests WHERE request_code IS NOT NULL ORDER BY request_code DESC LIMIT 1;`);
            let lastNumber = 0;
            if (lastCodeRes.rows.length > 0) {
                lastNumber = parseInt(lastCodeRes.rows[0].request_code.replace('HCR', ''), 10);
            }

            // Get all rows that need a code, ordered by creation time
            const rowsToUpdateRes = await backfillClient.query(`SELECT id, created_at FROM resource_requests WHERE request_code IS NULL ORDER BY created_at ASC;`);
            for (const row of rowsToUpdateRes.rows) {
                lastNumber++;
                const newRequestCode = `HCR${String(lastNumber).padStart(5, '0')}`;
                await backfillClient.query(`UPDATE resource_requests SET request_code = $1 WHERE id = $2;`, [newRequestCode, row.id]);
            }
            console.log(`${rowsToUpdateRes.rows.length} rows backfilled.`);
        }
        await backfillClient.query('COMMIT');
    } catch (error) {
        await backfillClient.query('ROLLBACK');
        console.error('Error during request_code backfill:', error);
        // Do not re-throw, allow the app to start, but log the error.
    } finally {
        backfillClient.release();
    }
}