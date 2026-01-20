
import type { VercelPool } from '@vercel/postgres';

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
    await db.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

    // 1. Core Config
    await db.sql`
        CREATE TABLE IF NOT EXISTS app_config (
            key VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;

    // 2. Base Dictionaries
    await db.sql`CREATE TABLE IF NOT EXISTS horizontals ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS seniority_levels ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS project_statuses ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS client_sectors ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS locations ( id UUID PRIMARY KEY, value VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS company_calendar ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, date DATE NOT NULL, type VARCHAR(50) NOT NULL, location VARCHAR(255), UNIQUE(date, location) );`;

    // 3. Skills Architecture
    await db.sql`CREATE TABLE IF NOT EXISTS skill_macro_categories ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS skill_categories ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS skill_category_macro_map ( category_id UUID REFERENCES skill_categories(id) ON DELETE CASCADE, macro_category_id UUID REFERENCES skill_macro_categories(id) ON DELETE CASCADE, PRIMARY KEY (category_id, macro_category_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS skills ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, is_certification BOOLEAN DEFAULT FALSE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS skill_skill_category_map ( skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, category_id UUID REFERENCES skill_categories(id) ON DELETE CASCADE, PRIMARY KEY (skill_id, category_id) );`;

    // 4. Operational Entities
    await db.sql`CREATE TABLE IF NOT EXISTS clients ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, sector VARCHAR(255), contact_email VARCHAR(255) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS roles ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, seniority_level VARCHAR(255), daily_cost NUMERIC(10, 2), standard_cost NUMERIC(10, 2), daily_expenses NUMERIC(10, 2) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS role_cost_history ( id UUID PRIMARY KEY, role_id UUID REFERENCES roles(id) ON DELETE CASCADE, daily_cost NUMERIC(10, 2) NOT NULL, start_date DATE NOT NULL, end_date DATE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS resources ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE, role_id UUID REFERENCES roles(id), horizontal VARCHAR(255), location VARCHAR(255), hire_date DATE, work_seniority INT, notes TEXT, max_staffing_percentage INT DEFAULT 100, resigned BOOLEAN DEFAULT FALSE, last_day_of_work DATE, tutor_id UUID REFERENCES resources(id) ON DELETE SET NULL );`;
    
    // 5. Skills Associations
    await db.sql`CREATE TABLE IF NOT EXISTS resource_skills ( resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, level INT, acquisition_date DATE, expiration_date DATE, PRIMARY KEY (resource_id, skill_id) );`;

    // 6. Security & RBAC
    await db.sql`CREATE TABLE IF NOT EXISTS app_users ( id UUID PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'SIMPLE', resource_id UUID REFERENCES resources(id) ON DELETE SET NULL, is_active BOOLEAN DEFAULT TRUE, must_change_password BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`;
    await db.sql`CREATE TABLE IF NOT EXISTS role_permissions ( role VARCHAR(50) NOT NULL, page_path VARCHAR(255) NOT NULL, is_allowed BOOLEAN DEFAULT FALSE, PRIMARY KEY (role, page_path) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS action_logs ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES app_users(id) ON DELETE SET NULL, username VARCHAR(255), action VARCHAR(100) NOT NULL, entity VARCHAR(100), entity_id VARCHAR(255), details JSONB, ip_address VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`;
    await db.sql`CREATE TABLE IF NOT EXISTS notifications ( id UUID PRIMARY KEY, recipient_resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, message TEXT NOT NULL, link VARCHAR(255), is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`;

    // Seed Permissions
    const permsCheck = await db.sql`SELECT COUNT(*) FROM role_permissions;`;
    if (permsCheck.rows[0].count === '0') {
        const simplePages = ['/staffing', '/workload', '/dashboard', '/leaves', '/resource-requests', '/interviews', '/manuale-utente', '/simple-user-manual', '/resources', '/notifications', '/skills-map', '/staffing-visualization'];
        const managerPages = [...simplePages, '/forecasting', '/gantt', '/reports', '/skill-analysis', '/skills', '/certifications', '/projects', '/clients', '/contracts'];

        for (const page of simplePages) {
            await db.sql`INSERT INTO role_permissions (role, page_path, is_allowed) VALUES ('SIMPLE', ${page}, TRUE);`;
        }
        for (const role of ['MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR']) {
            for (const page of managerPages) {
                await db.sql`INSERT INTO role_permissions (role, page_path, is_allowed) VALUES (${role}, ${page}, TRUE);`;
            }
        }
        const adminPages = [...managerPages, '/admin-settings', '/security-center', '/db-inspector', '/calendar', '/config', '/import', '/export'];
        for (const page of adminPages) {
            await db.sql`INSERT INTO role_permissions (role, page_path, is_allowed) VALUES ('ADMIN', ${page}, TRUE);`;
        }
    }

    // 7. Projects & Planning
    await db.sql`CREATE TABLE IF NOT EXISTS contracts ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, start_date DATE, end_date DATE, cig VARCHAR(255) NOT NULL UNIQUE, cig_derivato VARCHAR(255), capienza NUMERIC(15, 2) NOT NULL, backlog NUMERIC(15, 2) DEFAULT 0 );`;
    await db.sql`CREATE TABLE IF NOT EXISTS projects ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, client_id UUID REFERENCES clients(id), start_date DATE, end_date DATE, budget NUMERIC(12, 2), realization_percentage INT DEFAULT 100, project_manager VARCHAR(255), status VARCHAR(100), notes TEXT, contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL, UNIQUE(name, client_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS assignments ( id UUID PRIMARY KEY, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, UNIQUE(resource_id, project_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS allocations ( assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE, allocation_date DATE, percentage INT, PRIMARY KEY(assignment_id, allocation_date) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS contract_projects ( contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, PRIMARY KEY (contract_id, project_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS contract_managers ( contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, PRIMARY KEY (contract_id, resource_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS project_skills ( project_id UUID REFERENCES projects(id) ON DELETE CASCADE, skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, PRIMARY KEY (project_id, skill_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS wbs_tasks ( id UUID PRIMARY KEY, elemento_wbs VARCHAR(255) NOT NULL UNIQUE, descrizione_wbe TEXT, client_id UUID REFERENCES clients(id) ON DELETE SET NULL, periodo VARCHAR(50), ore NUMERIC(10, 2), produzione_lorda NUMERIC(12, 2), ore_network_italia NUMERIC(10, 2), produzione_lorda_network_italia NUMERIC(12, 2), perdite NUMERIC(12, 2), realisation INT, spese_onorari_esterni NUMERIC(12, 2), spese_altro NUMERIC(12, 2), fatture_onorari NUMERIC(12, 2), fatture_spese NUMERIC(12, 2), iva NUMERIC(12, 2), incassi NUMERIC(12, 2), primo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL, secondo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL );`;

    // 8. Recruitment & Operations
    await db.sql`CREATE TABLE IF NOT EXISTS resource_requests ( id UUID PRIMARY KEY, request_code VARCHAR(50), project_id UUID REFERENCES projects(id) ON DELETE CASCADE, role_id UUID REFERENCES roles(id) ON DELETE CASCADE, requestor_id UUID REFERENCES resources(id) ON DELETE SET NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, commitment_percentage INT NOT NULL, is_urgent BOOLEAN DEFAULT FALSE, is_long_term BOOLEAN DEFAULT FALSE, is_tech_request BOOLEAN DEFAULT FALSE, is_osr_open BOOLEAN DEFAULT FALSE, osr_number VARCHAR(50), notes TEXT, status VARCHAR(50) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`;
    await db.sql`CREATE TABLE IF NOT EXISTS interviews ( id UUID PRIMARY KEY, resource_request_id UUID REFERENCES resource_requests(id) ON DELETE SET NULL, candidate_name VARCHAR(255) NOT NULL, candidate_surname VARCHAR(255) NOT NULL, birth_date DATE, horizontal VARCHAR(255), role_id UUID REFERENCES roles(id) ON DELETE SET NULL, cv_summary TEXT, interviewers_ids UUID[], interview_date DATE, feedback VARCHAR(50), notes TEXT, hiring_status VARCHAR(50), entry_date DATE, status VARCHAR(50) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`;

    // 9. Leave Management
    await db.sql`CREATE TABLE IF NOT EXISTS leave_types ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, color VARCHAR(50) NOT NULL, requires_approval BOOLEAN DEFAULT TRUE, affects_capacity BOOLEAN DEFAULT TRUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS leave_requests ( id UUID PRIMARY KEY, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, type_id UUID REFERENCES leave_types(id) ON DELETE RESTRICT, start_date DATE NOT NULL, end_date DATE NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'PENDING', manager_id UUID REFERENCES resources(id) ON DELETE SET NULL, notes TEXT, approver_ids UUID[], is_half_day BOOLEAN DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`;

    // 10. Theme Seed
    const flattenPalette = (palette: object, prefix: string) => 
        Object.entries(palette).map(([key, value]) => ({ key: `theme.${prefix}.${key}`, value }));

    const themeSeed = [
        { key: 'theme.version', value: '2' },
        { key: 'theme.db.enabled', value: 'true' },
        { key: 'theme.toastPosition', value: 'top-center' },
        { key: 'theme.toastSuccessBackground', value: '#2e7d32' },
        { key: 'theme.toastSuccessForeground', value: '#ffffff' },
        { key: 'theme.toastErrorBackground', value: '#c62828' },
        { key: 'theme.toastErrorForeground', value: '#ffffff' },
        { key: 'theme.viz.sankey.nodeWidth', value: '20' },
        { key: 'theme.viz.sankey.nodePadding', value: '10' },
        { key: 'theme.viz.sankey.linkOpacity', value: '0.5' },
        { key: 'theme.viz.network.chargeStrength', value: '-400' },
        { key: 'theme.viz.network.linkDistance', value: '200' },
        { key: 'theme.viz.network.nodeRadius', value: '15' },
        ...flattenPalette(defaultThemeForSeed.light, 'light'),
        ...flattenPalette(defaultThemeForSeed.dark, 'dark'),
    ];

    for (const { key, value } of themeSeed) {
        await db.sql`INSERT INTO app_config (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO NOTHING;`;
    }
}
