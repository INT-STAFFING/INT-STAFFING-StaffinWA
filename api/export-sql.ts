
/**
 * @file api/export-sql.ts
 * @description Endpoint API to generate a full SQL dump (schema + data) for the entire database.
 * Rafforzato con controllo RBAC ADMIN.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// --- SECURITY HELPER ---
const verifyAdmin = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        return decoded.role === 'ADMIN';
    } catch (e) {
        return false;
    }
};

const TABLE_WHITELIST = [
    'horizontals', 'seniority_levels', 'project_statuses', 'client_sectors', 'locations', 'app_config',
    'leave_types',
    'clients', 'roles', 'resources', 'contracts', 'projects', 'resource_requests', 'leave_requests',
    'interviews', 'wbs_tasks', 'company_calendar', 'assignments', 'contract_projects', 'contract_managers', 'allocations',
    'skills', 'resource_skills', 'project_skills',
    'app_users', 'role_permissions'
];

const pgSchema = [
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    `CREATE TABLE IF NOT EXISTS horizontals ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`,
    `CREATE TABLE IF NOT EXISTS seniority_levels ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`,
    `CREATE TABLE IF NOT EXISTS project_statuses ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`,
    `CREATE TABLE IF NOT EXISTS client_sectors ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`,
    `CREATE TABLE IF NOT EXISTS locations ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`,
    `CREATE TABLE IF NOT EXISTS app_config ( key VARCHAR(255) PRIMARY KEY, value VARCHAR(255) NOT NULL );`,
    `CREATE TABLE IF NOT EXISTS leave_types ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, color VARCHAR(50) NOT NULL, requires_approval BOOLEAN DEFAULT TRUE, affects_capacity BOOLEAN DEFAULT TRUE );`,
    `CREATE TABLE IF NOT EXISTS clients ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, sector VARCHAR(255), contact_email VARCHAR(255) );`,
    `CREATE TABLE IF NOT EXISTS roles ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, seniority_level VARCHAR(255), daily_cost NUMERIC(10, 2), standard_cost NUMERIC(10, 2), daily_expenses NUMERIC(10, 2) );`,
    `CREATE TABLE IF NOT EXISTS resources ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE, role_id UUID REFERENCES roles(id), horizontal VARCHAR(255), hire_date DATE, work_seniority INT, notes TEXT, max_staffing_percentage INT DEFAULT 100 NOT NULL, location VARCHAR(255), resigned BOOLEAN DEFAULT FALSE, last_day_of_work DATE );`,
    `CREATE TABLE IF NOT EXISTS app_users ( id UUID PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'SIMPLE', resource_id UUID REFERENCES resources(id) ON DELETE SET NULL, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`,
    `CREATE TABLE IF NOT EXISTS role_permissions ( role VARCHAR(50) NOT NULL, page_path VARCHAR(255) NOT NULL, is_allowed BOOLEAN DEFAULT FALSE, PRIMARY KEY (role, page_path) );`,
    `CREATE TABLE IF NOT EXISTS leave_requests ( id UUID PRIMARY KEY, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, type_id UUID REFERENCES leave_types(id) ON DELETE RESTRICT, start_date DATE NOT NULL, end_date DATE NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'PENDING', manager_id UUID REFERENCES resources(id) ON DELETE SET NULL, notes TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
    `CREATE TABLE IF NOT EXISTS contracts ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, start_date DATE, end_date DATE, cig VARCHAR(255) NOT NULL, cig_derivato VARCHAR(255), wbs VARCHAR(255), capienza NUMERIC(15, 2) NOT NULL, backlog NUMERIC(15, 2) DEFAULT 0, UNIQUE(name), UNIQUE(cig) );`,
    `CREATE TABLE IF NOT EXISTS projects ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, client_id UUID REFERENCES clients(id), start_date DATE, end_date DATE, budget NUMERIC(12, 2), realization_percentage INT, project_manager VARCHAR(255), status VARCHAR(100), notes TEXT, contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL, UNIQUE(name, client_id) );`,
    `CREATE TABLE IF NOT EXISTS resource_requests ( id UUID PRIMARY KEY, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, role_id UUID REFERENCES roles(id) ON DELETE CASCADE, requestor_id UUID REFERENCES resources(id) ON DELETE SET NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, commitment_percentage INT NOT NULL, is_urgent BOOLEAN DEFAULT FALSE, is_long_term BOOLEAN DEFAULT FALSE, is_tech_request BOOLEAN DEFAULT FALSE, notes TEXT, status VARCHAR(50) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
    `CREATE TABLE IF NOT EXISTS interviews ( id UUID PRIMARY KEY, resource_request_id UUID REFERENCES resource_requests(id) ON DELETE SET NULL, candidate_name VARCHAR(255) NOT NULL, candidate_surname VARCHAR(255) NOT NULL, birth_date DATE, function VARCHAR(255), role_id UUID REFERENCES roles(id) ON DELETE SET NULL, cv_summary TEXT, interviewers_ids UUID[], interview_date DATE, feedback VARCHAR(50), notes TEXT, hiring_status VARCHAR(50), entry_date DATE, status VARCHAR(50) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`,
    `CREATE TABLE IF NOT EXISTS wbs_tasks ( id UUID PRIMARY KEY, elemento_wbs VARCHAR(255) NOT NULL UNIQUE, descrizione_wbe TEXT, client_id UUID REFERENCES clients(id) ON DELETE SET NULL, periodo VARCHAR(50), ore NUMERIC(10, 2), produzione_lorda NUMERIC(12, 2), ore_network_italia NUMERIC(10, 2), produzione_lorda_network_italia NUMERIC(12, 2), perdite NUMERIC(12, 2), realisation INT, spese_onorari_esterni NUMERIC(12, 2), spese_altro NUMERIC(12, 2), fatture_onorari NUMERIC(12, 2), fatture_spese NUMERIC(12, 2), iva NUMERIC(12, 2), incassi NUMERIC(12, 2), primo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL, secondo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL );`,
    `CREATE TABLE IF NOT EXISTS company_calendar ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, date DATE NOT NULL, type VARCHAR(50) NOT NULL, location VARCHAR(255), UNIQUE(date, location) );`,
    `CREATE TABLE IF NOT EXISTS assignments ( id UUID PRIMARY KEY, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, UNIQUE(resource_id, project_id) );`,
    `CREATE TABLE IF NOT EXISTS contract_projects ( contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, PRIMARY KEY (contract_id, project_id) );`,
    `CREATE TABLE IF NOT EXISTS contract_managers ( contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, PRIMARY KEY (contract_id, resource_id) );`,
    `CREATE TABLE IF NOT EXISTS allocations ( assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE, allocation_date DATE, percentage INT, PRIMARY KEY(assignment_id, allocation_date) );`,
    `CREATE TABLE IF NOT EXISTS skills ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, category VARCHAR(255) );`,
    `CREATE TABLE IF NOT EXISTS resource_skills ( resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, level INT, PRIMARY KEY (resource_id, skill_id) );`,
    `CREATE TABLE IF NOT EXISTS project_skills ( project_id UUID REFERENCES projects(id) ON DELETE CASCADE, skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, PRIMARY KEY (project_id, skill_id) );`
];

const translateToMysql = (pgStatement: string) => {
    return pgStatement
        .replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '-- UUID extension is not used in MySQL. IDs are CHAR(36).')
        .replace(/UUID/g, 'CHAR(36)')
        .replace(/NUMERIC/g, 'DECIMAL')
        .replace(/TIMESTAMP WITH TIME ZONE/g, 'TIMESTAMP')
        .replace(/BOOLEAN/g, 'TINYINT(1)')
        .replace(/CHAR\(36\)\[\]/g, 'TEXT') 
        .replace(/CREATE TABLE IF NOT EXISTS/g, 'CREATE TABLE IF NOT EXISTS');
};

const escapeSqlValue = (value: any, dialect: 'postgres' | 'mysql'): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return dialect === 'mysql' ? (value ? '1' : '0') : value.toString();
    if (typeof value === 'number') return value.toString();
    if (value instanceof Date) value = value.toISOString().slice(0, 19).replace('T', ' ');
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (Array.isArray(value)) {
        if (dialect === 'mysql') return `'${JSON.stringify(value)}'`;
        else return `ARRAY[${value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]::UUID[]`;
    }
    if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!verifyAdmin(req)) {
        return res.status(403).json({ error: 'Access denied: Admin role required for SQL Export.' });
    }

    const { dialect } = req.query;

    if (dialect !== 'postgres' && dialect !== 'mysql') {
        return res.status(400).json({ error: 'Invalid dialect specified. Use "postgres" or "mysql".' });
    }

    try {
        let sqlScript = `--- Database dump for ${dialect} ---\n\n`;
        
        const schemaStatements = dialect === 'postgres' ? pgSchema : pgSchema.map(translateToMysql);
        sqlScript += schemaStatements.join('\n\n');
        sqlScript += '\n\n';

        for (const table of TABLE_WHITELIST) {
            const { rows } = await db.query(`SELECT * FROM ${table}`);
            if (rows.length > 0) {
                const columns = Object.keys(rows[0]);
                const columnsList = dialect === 'mysql' ? columns.map(c => `\`${c}\``).join(', ') : columns.join(', ');
                
                sqlScript += `-- Data for table ${table}\n`;
                for (const row of rows) {
                    if (table === 'app_users' && 'password_hash' in row) {
                        row.password_hash = 'EXCLUDED_FOR_SECURITY';
                    }
                    const valuesList = columns.map(col => escapeSqlValue(row[col], dialect as 'postgres' | 'mysql')).join(', ');
                    sqlScript += `INSERT INTO ${table} (${columnsList}) VALUES (${valuesList});\n`;
                }
                sqlScript += '\n';
            }
        }

        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="db_export_${dialect}.sql"`);
        return res.status(200).send(sqlScript);

    } catch (error) {
        console.error(`Error exporting ${dialect} SQL:`, error);
        return res.status(500).json({ error: (error as Error).message });
    }
}