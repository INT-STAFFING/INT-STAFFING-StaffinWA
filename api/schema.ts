
import type { VercelPool } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const defaultThemeForSeed = {
    light: {
        primary: '#006493', onPrimary: '#ffffff', primaryContainer: '#cae6ff', onPrimaryContainer: '#001e2f',
        secondary: '#50606e', onSecondary: '#ffffff', secondaryContainer: '#d3e5f5', onSecondaryContainer: '#0c1d29',
        tertiary: '#64597b', onTertiary: '#ffffff', tertiaryContainer: '#eaddff', onTertiaryContainer: '#1f1635',
        error: '#ba1a1a', onError: '#ffffff', errorContainer: '#ffdad6', onErrorContainer: '#410002',
        background: '#f8fafc', onBackground: '#191c1e', surface: '#f8fafc', onSurface: '#191c1e',
        surfaceVariant: '#dee3e9', onSurfaceVariant: '#42474c', outline: '#72787d', outlineVariant: '#c2c7cd',
        shadow: '#000000', scrim: '#000000', inverseSurface: '#2e3133', inverseOnSurface: '#f0f1f3',
        inversePrimary: '#8dcdff', surfaceContainerLowest: '#ffffff', surfaceContainerLow: '#f2f4f7',
        surfaceContainer: '#eceef1', surfaceContainerHigh: '#e6e8eb', surfaceContainerHighest: '#e1e3e5',
    },
    dark: {
        primary: '#8dcdff',
        onPrimary: '#00344f',
        primaryContainer: '#004b70',
        onPrimaryContainer: '#cae6ff',
        secondary: '#b7c9d9',
        onSecondary: '#22323f',
        secondaryContainer: '#384956',
        onSecondaryContainer: '#d3e5f5',
        tertiary: '#cec0e8',
        onTertiary: '#352b4b',
        tertiaryContainer: '#4c4263',
        onTertiaryContainer: '#eaddff',
        error: '#ffb4ab',
        onError: '#690005',
        errorContainer: '#93000a',
        onErrorContainer: '#ffdad6',
        background: '#101418',
        onBackground: '#e1e3e5',
        surface: '#101418',
        onSurface: '#e1e3e5',
        surfaceVariant: '#42474c',
        onSurfaceVariant: '#c2c7cd',
        outline: '#8c9197',
        outlineVariant: '#42474c',
        shadow: '#000000',
        scrim: '#000000',
        inverseSurface: '#e1e3e5',
        inverseOnSurface: '#2e3133',
        inversePrimary: '#006493',
        surfaceContainerLowest: '#0b0f13',
        surfaceContainerLow: '#191c1e',
        surfaceContainer: '#1d2022',
        surfaceContainerHigh: '#272a2d',
        surfaceContainerHighest: '#323538',
    },
};

export async function ensureDbTablesExist(db: VercelPool) {
    // This function is idempotent, thanks to "IF NOT EXISTS".
    // It can be safely called on every API request without performance issues on subsequent calls.
    await db.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

    // --- ANALYTICS CACHE TABLE (New) ---
    await db.sql`
        CREATE TABLE IF NOT EXISTS analytics_cache (
            key VARCHAR(255) PRIMARY KEY,
            data JSONB NOT NULL,
            scope VARCHAR(100) DEFAULT 'GLOBAL',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_stale BOOLEAN DEFAULT FALSE
        );
    `;

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

    // Leave Management Tables
    await db.sql`
        CREATE TABLE IF NOT EXISTS leave_types (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            color VARCHAR(50) NOT NULL,
            requires_approval BOOLEAN DEFAULT TRUE,
            affects_capacity BOOLEAN DEFAULT TRUE
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
    
    // New Role Cost History Table for SCD Type 2
    await db.sql`
        CREATE TABLE IF NOT EXISTS role_cost_history (
            id UUID PRIMARY KEY,
            role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
            daily_cost NUMERIC(10, 2) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE
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
            max_staffing_percentage INT DEFAULT 100 NOT NULL
        );
    `;
    // Add columns if they don't exist to handle migration for existing databases.
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS location VARCHAR(255);`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS max_staffing_percentage INT DEFAULT 100 NOT NULL;`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS resigned BOOLEAN DEFAULT FALSE;`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS last_day_of_work DATE;`;
    // Add tutor_id self-reference
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES resources(id) ON DELETE SET NULL;`;

    // --- USER AUTHENTICATION TABLES (Phase 1) ---
    await db.sql`
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
    // MIGRATION: Add must_change_password column
    await db.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;`;

    await db.sql`
        CREATE TABLE IF NOT EXISTS role_permissions (
            role VARCHAR(50) NOT NULL,
            page_path VARCHAR(255) NOT NULL,
            is_allowed BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (role, page_path)
        );
    `;

    // --- AUDIT LOG TABLE (New) ---
    await db.sql`
        CREATE TABLE IF NOT EXISTS action_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
            username VARCHAR(255),
            action VARCHAR(100) NOT NULL,
            entity VARCHAR(100),
            entity_id VARCHAR(255),
            details JSONB,
            ip_address VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    // Index for performance
    await db.sql`CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs(created_at);`;
    await db.sql`CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON action_logs(user_id);`;


    const simplePages = ['/staffing', '/workload', '/dashboard', '/leaves', '/resource-requests', '/interviews', '/manuale-utente', '/resources', '/notifications'];
    const managerPages = [...simplePages, '/forecasting', '/gantt', '/reports', '/skill-analysis', '/skills', '/certifications', '/projects', '/clients', '/contracts'];

    const permsCheck = await db.sql`SELECT COUNT(*) FROM role_permissions;`;
    if (permsCheck.rows[0].count === '0') {
        for (const page of simplePages) {
            await db.sql`INSERT INTO role_permissions (role, page_path, is_allowed) VALUES ('SIMPLE', ${page}, TRUE) ON CONFLICT DO NOTHING;`;
        }
        for (const page of managerPages) {
            await db.sql`INSERT INTO role_permissions (role, page_path, is_allowed) VALUES ('MANAGER', ${page}, TRUE) ON CONFLICT DO NOTHING;`;
        }
    }

    // --- NEW ROLES MIGRATION ---
    // Ensures SENIOR MANAGER and MANAGING DIRECTOR have permissions
    for (const role of ['SENIOR MANAGER', 'MANAGING DIRECTOR']) {
        for (const page of managerPages) {
             await db.sql`
                INSERT INTO role_permissions (role, page_path, is_allowed) 
                VALUES (${role}, ${page}, TRUE) 
                ON CONFLICT (role, page_path) DO NOTHING;
            `;
        }
    }

    // --- PERMISSION HARDENING MIGRATION ---
    // Fix for issue where SIMPLE users see manager pages due to old permissive seeds.
    const restrictedPagesForSimple = [
        '/staffing', '/resources', '/skills', '/certifications', '/projects', '/contracts',
        '/clients', '/roles', '/config', '/calendar', '/import', '/export',
        '/test-staffing', '/forecasting', '/gantt', '/reports',
        '/skill-analysis', '/staffing-visualization', '/resource-requests',
        '/interviews', '/skills-map', '/admin-settings', '/db-inspector'
    ];

    await Promise.all(restrictedPagesForSimple.map(path => 
        db.sql`
            INSERT INTO role_permissions (role, page_path, is_allowed)
            VALUES ('SIMPLE', ${path}, FALSE)
            ON CONFLICT (role, page_path)
            DO UPDATE SET is_allowed = FALSE;
        `
    ));

    // --- MIGRATION: Ensure Notification & Certifications permissions exist ---
    const rolesToUpdate = ['SIMPLE', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];
    for (const role of rolesToUpdate) {
        await db.sql`
            INSERT INTO role_permissions (role, page_path, is_allowed)
            VALUES (${role}, '/notifications', TRUE)
            ON CONFLICT (role, page_path) DO NOTHING;
        `;
    }
    
    // Certifications for Managers
    const certRoles = ['MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'];
    for (const role of certRoles) {
        await db.sql`
            INSERT INTO role_permissions (role, page_path, is_allowed)
            VALUES (${role}, '/certifications', TRUE)
            ON CONFLICT (role, page_path) DO NOTHING;
        `;
    }


    // Leave Requests Table (Needs Resources)
    await db.sql`
        CREATE TABLE IF NOT EXISTS leave_requests (
            id UUID PRIMARY KEY,
            resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
            type_id UUID REFERENCES leave_types(id) ON DELETE RESTRICT,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
            manager_id UUID REFERENCES resources(id) ON DELETE SET NULL,
            approver_ids UUID[],
            notes TEXT,
            is_half_day BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;
    await db.sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approver_ids UUID[];`;
    // Migration for half day support
    await db.sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE;`;

    // --- NOTIFICATIONS TABLE ---
    await db.sql`
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY,
            recipient_resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            link VARCHAR(255),
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    // MIGRATION: Add OSR fields
    await db.sql`ALTER TABLE resource_requests ADD COLUMN IF NOT EXISTS is_osr_open BOOLEAN DEFAULT FALSE;`;
    await db.sql`ALTER TABLE resource_requests ADD COLUMN IF NOT EXISTS osr_number VARCHAR(255);`;


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

    // --- SKILLS TABLES V2 ---
    await db.sql`
        CREATE TABLE IF NOT EXISTS skills (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            is_certification BOOLEAN DEFAULT FALSE
        );
    `;
    
    // New Relational Tables for Skills
    await db.sql`
        CREATE TABLE IF NOT EXISTS skill_macro_categories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL UNIQUE
        );
    `;

    await db.sql`
        CREATE TABLE IF NOT EXISTS skill_categories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL UNIQUE
        );
    `;

    await db.sql`
        CREATE TABLE IF NOT EXISTS skill_category_macro_map (
            category_id UUID REFERENCES skill_categories(id) ON DELETE CASCADE,
            macro_category_id UUID REFERENCES skill_macro_categories(id) ON DELETE CASCADE,
            PRIMARY KEY (category_id, macro_category_id)
        );
    `;

    await db.sql`
        CREATE TABLE IF NOT EXISTS skill_skill_category_map (
            skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
            category_id UUID REFERENCES skill_categories(id) ON DELETE CASCADE,
            PRIMARY KEY (skill_id, category_id)
        );
    `;

    await db.sql`
        CREATE TABLE IF NOT EXISTS resource_skills (
            resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
            skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
            level INT,
            PRIMARY KEY (resource_id, skill_id)
        );
    `;
    await db.sql`ALTER TABLE resource_skills ADD COLUMN IF NOT EXISTS acquisition_date DATE;`;
    await db.sql`ALTER TABLE resource_skills ADD COLUMN IF NOT EXISTS expiration_date DATE;`;
    await db.sql`ALTER TABLE resource_skills ADD COLUMN IF NOT EXISTS level INT;`;

    await db.sql`
        CREATE TABLE IF NOT EXISTS project_skills (
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
            PRIMARY KEY (project_id, skill_id)
        );
    `;

    // Application Configuration Table
    await db.sql`
        CREATE TABLE IF NOT EXISTS app_config (
            key VARCHAR(255) PRIMARY KEY,
            value VARCHAR(255) NOT NULL
        );
    `;
    // MIGRATION: Change value column type to TEXT to support large JSON payloads (e.g. sidebar config)
    await db.sql`ALTER TABLE app_config ALTER COLUMN value TYPE TEXT;`;

     await db.sql`
        INSERT INTO app_config (key, value) 
        VALUES ('login_protection_enabled', 'true') 
        ON CONFLICT (key) DO NOTHING;
    `;

    // SEED SIDEBAR SECTIONS
    const defaultSections = ['Principale', 'Progetti', 'Risorse', 'Operatività', 'Supporto', 'Configurazione', 'Dati'];
    await db.sql`
        INSERT INTO app_config (key, value) 
        VALUES ('sidebar_sections_v1', ${JSON.stringify(defaultSections)}) 
        ON CONFLICT (key) DO NOTHING;
    `;

    const defaultFooterActions = [
        { id: 'changePassword', label: 'Cambia Password', icon: 'lock_reset', color: 'primary' },
        { id: 'logout', label: 'Logout', icon: 'logout', color: 'error' }
    ];
    await db.sql`
        INSERT INTO app_config (key, value)
        VALUES ('sidebar_footer_actions_v1', ${JSON.stringify(defaultFooterActions)})
        ON CONFLICT (key) DO NOTHING;
    `;

    // --- SEED DEFAULT ROLE HOME PAGES ---
    const defaultRoleHomePages = {
        'SIMPLE': '/dashboard',
        'MANAGER': '/staffing',
        'SENIOR MANAGER': '/staffing',
        'MANAGING DIRECTOR': '/staffing',
        'ADMIN': '/staffing'
    };
    await db.sql`
        INSERT INTO app_config (key, value)
        VALUES ('role_home_pages_v1', ${JSON.stringify(defaultRoleHomePages)})
        ON CONFLICT (key) DO NOTHING;
    `;

    // --- MIGRATION: Ensure Sidebar Config has Notifications & Certifications ---
    try {
        const sidebarConfigRes = await db.sql`SELECT value FROM app_config WHERE key = 'sidebar_layout_v1'`;
        if (sidebarConfigRes.rows.length > 0) {
            const currentConfig = JSON.parse(sidebarConfigRes.rows[0].value);
            let needsUpdate = false;
            let newConfig = [...currentConfig];

            // 1. Check Notifications
            const hasNotifications = newConfig.some((item: any) => item.path === '/notifications');
            if (!hasNotifications) {
                const dashboardIdx = newConfig.findIndex((item: any) => item.path === '/dashboard');
                const insertIdx = dashboardIdx >= 0 ? dashboardIdx + 1 : 0;
                newConfig.splice(insertIdx, 0, { 
                    path: "/notifications", 
                    label: "Notifiche", 
                    icon: "notifications", 
                    section: "Principale" 
                });
                needsUpdate = true;
            }

            // 2. Check Certifications
            const hasCerts = newConfig.some((item: any) => item.path === '/certifications');
            if (!hasCerts) {
                const skillsIdx = newConfig.findIndex((item: any) => item.path === '/skills');
                const insertIdx = skillsIdx >= 0 ? skillsIdx + 1 : newConfig.length;
                newConfig.splice(insertIdx, 0, { 
                    path: "/certifications", 
                    label: "Certificazioni", 
                    icon: "verified", 
                    section: "Risorse" 
                });
                needsUpdate = true;
            }

            if (needsUpdate) {
                await db.sql`UPDATE app_config SET value = ${JSON.stringify(newConfig)} WHERE key = 'sidebar_layout_v1'`;
            }
        }
    } catch (e) {
        console.error("Migration sidebar error (non-blocking):", e);
    }


    // Backfill for Role Cost History (Seeding history from current roles if empty)
    const historyCheck = await db.sql`SELECT COUNT(*) FROM role_cost_history;`;
    if (historyCheck.rows[0].count === '0') {
        const existingRoles = await db.sql`SELECT id, daily_cost FROM roles;`;
        if (existingRoles.rows.length > 0) {
             console.log('Backfilling role cost history...');
             for (const role of existingRoles.rows) {
                 const newId = uuidv4();
                 // Start date far in the past to cover all existing allocations
                 const startDate = '2020-01-01'; 
                 await db.sql`
                    INSERT INTO role_cost_history (id, role_id, daily_cost, start_date)
                    VALUES (${newId}, ${role.id}, ${role.daily_cost}, ${startDate});
                 `;
             }
             console.log('Role cost history backfilled.');
        }
    }

    // Backfill request_code for existing resource_requests
    const backfillClient = await db.connect();
    try {
        await backfillClient.query('BEGIN');
        const needsBackfillRes = await backfillClient.query(`SELECT id FROM resource_requests WHERE request_code IS NULL LIMIT 1;`);
        if (needsBackfillRes.rows.length > 0) {
            console.log('Backfilling request_code for resource_requests...');
            const lastCodeRes = await backfillClient.query(`SELECT request_code FROM resource_requests WHERE request_code IS NOT NULL ORDER BY request_code DESC LIMIT 1;`);
            let lastNumber = 0;
            if (lastCodeRes.rows.length > 0) {
                lastNumber = parseInt(lastCodeRes.rows[0].request_code.replace('HCR', ''), 10);
            }

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
    } finally {
        backfillClient.release();
    }
    
    // Seed initial theme configuration
    const flattenPalette = (palette: object, prefix: string) => 
        Object.entries(palette).map(([key, value]) => ({ key: `theme.${prefix}.${key}`, value }));

    const themeSeed = [
        { key: 'theme.version', value: '1' },
        { key: 'theme.db.enabled', value: 'true' },
        ...flattenPalette(defaultThemeForSeed.light, 'light'),
        ...flattenPalette(defaultThemeForSeed.dark, 'dark'),
    ];

    const themeClient = await db.connect();
    try {
        await themeClient.query('BEGIN');
        for (const { key, value } of themeSeed) {
            await themeClient.query(
                `INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING;`,
                [key, value]
            );
        }
        await themeClient.query('COMMIT');
    } catch (error) {
        await themeClient.query('ROLLBACK');
        console.error("Failed to seed theme config:", error);
    } finally {
        themeClient.release();
    }
}
