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
            daily_cost NUMERIC(10, 2)
        );
    `;
    
    await db.sql`
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
    // Add the location column if it doesn't exist to handle migration for existing databases.
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS location VARCHAR(255);`;

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
}