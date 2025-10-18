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
            location VARCHAR(255),
            max_staffing_percentage INT DEFAULT 100 NOT NULL
        );
    `;

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

    // Recruitment Module Table
    await db.sql`
        CREATE TABLE IF NOT EXISTS candidates (
            id UUID PRIMARY KEY,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            birth_year INT,
            horizontal VARCHAR(255),
            role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
            cv_summary TEXT,
            interviewers UUID[],
            next_interview_date DATE,
            interview_feedback VARCHAR(50),
            notes TEXT,
            entry_date DATE,
            status VARCHAR(50),
            pipeline_status VARCHAR(100) NOT NULL
        );
    `;
}