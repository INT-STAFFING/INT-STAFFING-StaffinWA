
import type { VercelPool } from '@vercel/postgres';

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
    await db.sql`CREATE TABLE IF NOT EXISTS company_calendar ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, date DATE NOT NULL, type VARCHAR(50) NOT NULL, location VARCHAR(255), version INT DEFAULT 1, UNIQUE(date, location) );`;
    await db.sql`ALTER TABLE company_calendar ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;

    // 3. Skills Architecture
    await db.sql`CREATE TABLE IF NOT EXISTS skill_macro_categories ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS skill_categories ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE );`;
    await db.sql`CREATE TABLE IF NOT EXISTS skill_category_macro_map ( category_id UUID REFERENCES skill_categories(id) ON DELETE CASCADE, macro_category_id UUID REFERENCES skill_macro_categories(id) ON DELETE CASCADE, PRIMARY KEY (category_id, macro_category_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS skills ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, is_certification BOOLEAN DEFAULT FALSE, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE skills ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    await db.sql`CREATE TABLE IF NOT EXISTS skill_skill_category_map ( skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, category_id UUID REFERENCES skill_categories(id) ON DELETE CASCADE, PRIMARY KEY (skill_id, category_id) );`;

    // 4. Operational Entities
    await db.sql`CREATE TABLE IF NOT EXISTS clients ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, sector VARCHAR(255), contact_email VARCHAR(255), version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    
    await db.sql`CREATE TABLE IF NOT EXISTS roles ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, seniority_level VARCHAR(255), daily_cost NUMERIC(10, 2), standard_cost NUMERIC(10, 2), daily_expenses NUMERIC(10, 2), overhead_pct NUMERIC(5, 2) DEFAULT 0, chargeable_pct NUMERIC(5, 2) DEFAULT 100, training_pct NUMERIC(5, 2) DEFAULT 0, bd_pct NUMERIC(5, 2) DEFAULT 0, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    await db.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS chargeable_pct NUMERIC(5, 2) DEFAULT 100;`;
    await db.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS training_pct NUMERIC(5, 2) DEFAULT 0;`;
    await db.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS bd_pct NUMERIC(5, 2) DEFAULT 0;`;
    await db.sql`ALTER TABLE roles ADD COLUMN IF NOT EXISTS overhead_pct NUMERIC(5, 2) DEFAULT 0;`;

    await db.sql`CREATE TABLE IF NOT EXISTS role_cost_history ( id UUID PRIMARY KEY, role_id UUID REFERENCES roles(id) ON DELETE CASCADE, daily_cost NUMERIC(10, 2) NOT NULL, start_date DATE NOT NULL, end_date DATE );`;
    
    await db.sql`CREATE TABLE IF NOT EXISTS resources ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE, role_id UUID REFERENCES roles(id), horizontal VARCHAR(255), location VARCHAR(255), hire_date DATE, work_seniority INT, notes TEXT, max_staffing_percentage INT DEFAULT 100, resigned BOOLEAN DEFAULT FALSE, last_day_of_work DATE, tutor_id UUID REFERENCES resources(id) ON DELETE SET NULL, daily_cost NUMERIC(10, 2) DEFAULT 0, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    await db.sql`ALTER TABLE resources ADD COLUMN IF NOT EXISTS daily_cost NUMERIC(10, 2) DEFAULT 0;`;

    // 5. Skills Associations
    await db.sql`CREATE TABLE IF NOT EXISTS resource_skills ( resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, level INT, acquisition_date DATE, expiration_date DATE, PRIMARY KEY (resource_id, skill_id) );`;

    // 6. Security & RBAC
    await db.sql`CREATE TABLE IF NOT EXISTS app_users ( id UUID PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) NOT NULL DEFAULT 'SIMPLE', resource_id UUID REFERENCES resources(id) ON DELETE SET NULL, is_active BOOLEAN DEFAULT TRUE, must_change_password BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    await db.sql`CREATE TABLE IF NOT EXISTS role_permissions ( role VARCHAR(50) NOT NULL, page_path VARCHAR(255) NOT NULL, is_allowed BOOLEAN DEFAULT FALSE, PRIMARY KEY (role, page_path) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS action_logs ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES app_users(id) ON DELETE SET NULL, username VARCHAR(255), action VARCHAR(100) NOT NULL, entity VARCHAR(100), entity_id VARCHAR(255), details JSONB, ip_address VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`;
    await db.sql`CREATE TABLE IF NOT EXISTS notifications ( id UUID PRIMARY KEY, recipient_resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, title VARCHAR(255) NOT NULL, message TEXT NOT NULL, link VARCHAR(255), is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );`;
    await db.sql`CREATE TABLE IF NOT EXISTS notification_configs ( id UUID PRIMARY KEY, event_type VARCHAR(50) NOT NULL, webhook_url TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE notification_configs ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;

    // 7. Projects & Planning
    await db.sql`CREATE TABLE IF NOT EXISTS rate_cards ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, currency VARCHAR(10) DEFAULT 'EUR', version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE rate_cards ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    
    const rateCardCheck = await db.sql`SELECT to_regclass('public.rate_card_entries') as exists;`;
    if (!rateCardCheck.rows[0].exists) {
         await db.sql`CREATE TABLE rate_card_entries ( rate_card_id UUID REFERENCES rate_cards(id) ON DELETE CASCADE, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, daily_rate NUMERIC(10, 2) NOT NULL, PRIMARY KEY (rate_card_id, resource_id) );`;
    }

    await db.sql`CREATE TABLE IF NOT EXISTS contracts ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, start_date DATE, end_date DATE, cig VARCHAR(255) NOT NULL UNIQUE, cig_derivato VARCHAR(255), wbs VARCHAR(255), capienza NUMERIC(15, 2) NOT NULL, backlog NUMERIC(15, 2) DEFAULT 0, rate_card_id UUID REFERENCES rate_cards(id) ON DELETE SET NULL, billing_type VARCHAR(50) DEFAULT 'TIME_MATERIAL', version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    
    await db.sql`CREATE TABLE IF NOT EXISTS projects ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL, client_id UUID REFERENCES clients(id), start_date DATE, end_date DATE, budget NUMERIC(12, 2), realization_percentage INT DEFAULT 100, project_manager VARCHAR(255), status VARCHAR(100), notes TEXT, contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL, billing_type VARCHAR(50) DEFAULT 'TIME_MATERIAL', version INT DEFAULT 1, UNIQUE(name, client_id) );`;
    await db.sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    
    await db.sql`CREATE TABLE IF NOT EXISTS assignments ( id UUID PRIMARY KEY, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, UNIQUE(resource_id, project_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS allocations ( assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE, allocation_date DATE, percentage INT, PRIMARY KEY(assignment_id, allocation_date) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS contract_projects ( contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, PRIMARY KEY (contract_id, project_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS contract_managers ( contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, PRIMARY KEY (contract_id, resource_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS project_skills ( project_id UUID REFERENCES projects(id) ON DELETE CASCADE, skill_id UUID REFERENCES skills(id) ON DELETE CASCADE, PRIMARY KEY (project_id, skill_id) );`;
    await db.sql`CREATE TABLE IF NOT EXISTS wbs_tasks ( id UUID PRIMARY KEY, elemento_wbs VARCHAR(255) NOT NULL UNIQUE, descrizione_wbe TEXT, client_id UUID REFERENCES clients(id) ON DELETE SET NULL, periodo VARCHAR(50), ore NUMERIC(10, 2), produzione_lorda NUMERIC(12, 2), ore_network_italia NUMERIC(10, 2), produzione_lorda_network_italia NUMERIC(12, 2), perdite NUMERIC(12, 2), realisation INT, spese_onorari_esterni NUMERIC(12, 2), spese_altro NUMERIC(12, 2), fatture_onorari NUMERIC(12, 2), fatture_spese NUMERIC(12, 2), iva NUMERIC(12, 2), incassi NUMERIC(12, 2), primo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL, secondo_responsabile_id UUID REFERENCES resources(id) ON DELETE SET NULL );`;
    
    await db.sql`CREATE TABLE IF NOT EXISTS project_expenses ( id UUID PRIMARY KEY, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, category VARCHAR(255) NOT NULL, description TEXT, amount NUMERIC(12, 2) NOT NULL, date DATE NOT NULL, billable BOOLEAN DEFAULT FALSE, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;

    await db.sql`CREATE TABLE IF NOT EXISTS billing_milestones ( id UUID PRIMARY KEY, project_id UUID REFERENCES projects(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, date DATE NOT NULL, amount NUMERIC(12, 2) NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'PLANNED', version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE billing_milestones ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;

    // 8. Recruitment & Operations
    await db.sql`CREATE TABLE IF NOT EXISTS resource_requests ( id UUID PRIMARY KEY, request_code VARCHAR(50), project_id UUID REFERENCES projects(id) ON DELETE CASCADE, role_id UUID REFERENCES roles(id) ON DELETE CASCADE, requestor_id UUID REFERENCES resources(id) ON DELETE SET NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, commitment_percentage INT NOT NULL, is_urgent BOOLEAN DEFAULT FALSE, is_long_term BOOLEAN DEFAULT FALSE, is_tech_request BOOLEAN DEFAULT FALSE, is_osr_open BOOLEAN DEFAULT FALSE, osr_number VARCHAR(50), notes TEXT, status VARCHAR(50) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE resource_requests ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    
    await db.sql`CREATE TABLE IF NOT EXISTS interviews ( id UUID PRIMARY KEY, resource_request_id UUID REFERENCES resource_requests(id) ON DELETE SET NULL, candidate_name VARCHAR(255) NOT NULL, candidate_surname VARCHAR(255) NOT NULL, birth_date DATE, horizontal VARCHAR(255), role_id UUID REFERENCES roles(id) ON DELETE SET NULL, cv_summary TEXT, interviewers_ids UUID[], interview_date DATE, feedback VARCHAR(50), notes TEXT, hiring_status VARCHAR(50), entry_date DATE, status VARCHAR(50) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    // Ratings columns for interviews
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_technical_mastery INT;`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_problem_solving INT;`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_method_quality INT;`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_domain_knowledge INT;`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_autonomy INT;`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_communication INT;`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_proactivity INT;`;
    await db.sql`ALTER TABLE interviews ADD COLUMN IF NOT EXISTS rating_team_fit INT;`;

    // 9. Leave Management
    await db.sql`CREATE TABLE IF NOT EXISTS leave_types ( id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, color VARCHAR(50) NOT NULL, requires_approval BOOLEAN DEFAULT TRUE, affects_capacity BOOLEAN DEFAULT TRUE, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    await db.sql`CREATE TABLE IF NOT EXISTS leave_requests ( id UUID PRIMARY KEY, resource_id UUID REFERENCES resources(id) ON DELETE CASCADE, type_id UUID REFERENCES leave_types(id) ON DELETE RESTRICT, start_date DATE NOT NULL, end_date DATE NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'PENDING', manager_id UUID REFERENCES resources(id) ON DELETE SET NULL, notes TEXT, approver_ids UUID[], is_half_day BOOLEAN DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, version INT DEFAULT 1 );`;
    await db.sql`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;`;
    
    // 10. Analytics Cache
    await db.sql`
        CREATE TABLE IF NOT EXISTS analytics_cache (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            key VARCHAR(255) UNIQUE NOT NULL,
            data JSONB,
            scope VARCHAR(50),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
}
