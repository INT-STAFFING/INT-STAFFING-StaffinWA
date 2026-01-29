
// Configurazione URL database
if (process.env.NEON_POSTGRES_URL && !process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL = process.env.NEON_POSTGRES_URL;
}

import { createPool } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
 
const db = createPool({
    connectionString: process.env.POSTGRES_URL,
});

async function main() {
    const client = await db.connect();
    const salt = bcrypt.genSaltSync(10);
    
    try {
        console.log('--- Inizio Seeding Totale ---');
        
        // Ensure critical tables exist before truncating to avoid "relation does not exist" errors on fresh runs
        await client.sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
        await client.sql`
            CREATE TABLE IF NOT EXISTS analytics_cache (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                key VARCHAR(255) UNIQUE NOT NULL,
                data JSONB,
                scope VARCHAR(50),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 0. RESET DATABASE (Ordine critico per Cascade)
        console.log('0. Resetting tables...');
        await client.sql`
            TRUNCATE 
                analytics_cache, allocations, assignments, project_skills, resource_skills, 
                skill_skill_category_map, skill_category_macro_map, skills, skill_categories, 
                skill_macro_categories, interviews, resource_requests, wbs_tasks, 
                company_calendar, projects, contracts, leave_requests, leave_types, 
                app_users, role_permissions, role_cost_history, resources, roles, 
                clients, locations, client_sectors, project_statuses, seniority_levels, 
                horizontals, app_config, action_logs
            RESTART IDENTITY CASCADE;
        `;

        // 1. LOOKUP TABLES
        console.log('1. Seeding Lookups...');
        const h_ids = [uuidv4(), uuidv4(), uuidv4()];
        await client.query(`INSERT INTO horizontals (id, value) VALUES ('${h_ids[0]}', 'Software Engineering'), ('${h_ids[1]}', 'Data & AI'), ('${h_ids[2]}', 'Business Transformation')`);

        const sl_ids = [uuidv4(), uuidv4(), uuidv4(), uuidv4()];
        await client.query(`INSERT INTO seniority_levels (id, value) VALUES ('${sl_ids[0]}', 'Junior'), ('${sl_ids[1]}', 'Middle'), ('${sl_ids[2]}', 'Senior'), ('${sl_ids[3]}', 'Manager')`);

        const ps_ids = [uuidv4(), uuidv4(), uuidv4()];
        await client.query(`INSERT INTO project_statuses (id, value) VALUES ('${ps_ids[0]}', 'Pianificato'), ('${ps_ids[1]}', 'In corso'), ('${ps_ids[2]}', 'Completato')`);

        const cs_ids = [uuidv4(), uuidv4(), uuidv4()];
        await client.query(`INSERT INTO client_sectors (id, value) VALUES ('${cs_ids[0]}', 'Banking'), ('${cs_ids[1]}', 'Energy'), ('${cs_ids[2]}', 'Public Sector')`);

        const loc_ids = [uuidv4(), uuidv4(), uuidv4()];
        await client.query(`INSERT INTO locations (id, value) VALUES ('${loc_ids[0]}', 'Milano'), ('${loc_ids[1]}', 'Roma'), ('${loc_ids[2]}', 'Torino')`);

        // 2. SKILL ARCHITECTURE
        console.log('2. Seeding Skill Hierarchy...');
        const m_tech = uuidv4();
        const m_soft = uuidv4();
        await client.query(`INSERT INTO skill_macro_categories (id, name) VALUES ('${m_tech}', 'Technology'), ('${m_soft}', 'Soft Skills')`);

        const cat_fe = uuidv4();
        const cat_be = uuidv4();
        await client.query(`INSERT INTO skill_categories (id, name) VALUES ('${cat_fe}', 'Frontend Development'), ('${cat_be}', 'Backend Development')`);
        await client.query(`INSERT INTO skill_category_macro_map (category_id, macro_category_id) VALUES ('${cat_fe}', '${m_tech}'), ('${cat_be}', '${m_tech}')`);

        const s_react = uuidv4();
        const s_node = uuidv4();
        await client.query(`INSERT INTO skills (id, name, is_certification) VALUES ('${s_react}', 'React', false), ('${s_node}', 'Node.js', false)`);
        await client.query(`INSERT INTO skill_skill_category_map (skill_id, category_id) VALUES ('${s_react}', '${cat_fe}'), ('${s_node}', '${cat_be}')`);

        // 3. ROLES & COST HISTORY
        console.log('3. Seeding Roles...');
        const r_dev = uuidv4();
        const r_pm = uuidv4();
        await client.query(`INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES 
            ('${r_dev}', 'Senior Developer', 'Senior', 600, 550, 21),
            ('${r_pm}', 'Project Manager', 'Manager', 800, 750, 28)`);
        
        await client.query(`INSERT INTO role_cost_history (id, role_id, daily_cost, start_date) VALUES ('${uuidv4()}', '${r_dev}', 550, '2023-01-01')`);

        // 4. RESOURCES & USERS
        console.log('4. Seeding Resources & Users...');
        const res_mario = uuidv4();
        const res_elena = uuidv4();
        await client.query(`INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority) VALUES 
            ('${res_mario}', 'Mario Rossi', 'm.rossi@partner.it', '${r_dev}', 'Software Engineering', 'Milano', '2022-01-10', 8),
            ('${res_elena}', 'Elena Bianchi', 'e.bianchi@partner.it', '${r_pm}', 'Business Transformation', 'Roma', '2021-05-15', 12)`);

        await client.query(`INSERT INTO app_users (id, username, password_hash, role, resource_id) VALUES 
            ('${uuidv4()}', 'admin', '${bcrypt.hashSync('admin123!', salt)}', 'ADMIN', NULL),
            ('${uuidv4()}', 'mario.rossi', '${bcrypt.hashSync('mario123!', salt)}', 'SIMPLE', '${res_mario}'),
            ('${uuidv4()}', 'elena.bianchi', '${bcrypt.hashSync('elena123!', salt)}', 'MANAGER', '${res_elena}')`);

        // 5. SKILL MAPPING
        await client.query(`INSERT INTO resource_skills (resource_id, skill_id, level, acquisition_date) VALUES ('${res_mario}', '${s_react}', 5, '2022-02-01')`);

        // 6. CLIENTS & CONTRACTS
        console.log('6. Seeding CRM...');
        const cli_bank = uuidv4();
        await client.query(`INSERT INTO clients (id, name, sector, contact_email) VALUES ('${cli_bank}', 'Banca Intesa', 'Banking', 'it@intesa.it')`);

        const cont_1 = uuidv4();
        await client.query(`INSERT INTO contracts (id, name, cig, capienza, backlog, start_date, end_date) VALUES 
            ('${cont_1}', 'Accordo Quadro Sviluppo 2024', 'Z123456789', 500000, 450000, '2024-01-01', '2024-12-31')`);
        await client.query(`INSERT INTO contract_managers (contract_id, resource_id) VALUES ('${cont_1}', '${res_elena}')`);

        // 7. PROJECTS & PLANNING
        console.log('7. Seeding Projects & Staffing...');
        const p_mobile = uuidv4();
        await client.query(`INSERT INTO projects (id, name, client_id, contract_id, start_date, end_date, budget, status, realization_percentage) VALUES 
            ('${p_mobile}', 'App Mobile Intesa', '${cli_bank}', '${cont_1}', '2024-02-01', '2024-11-30', 120000, 'In corso', 100)`);
        await client.query(`INSERT INTO contract_projects (contract_id, project_id) VALUES ('${cont_1}', '${p_mobile}')`);

        const asg_1 = uuidv4();
        await client.query(`INSERT INTO assignments (id, resource_id, project_id) VALUES ('${asg_1}', '${res_mario}', '${p_mobile}')`);
        
        // Allocazioni per il mese corrente
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        for(let d=1; d<=daysInMonth; d++) {
            const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayOfWeek = new Date(dateStr).getDay();
            if(dayOfWeek !== 0 && dayOfWeek !== 6) {
                await client.query(`INSERT INTO allocations (assignment_id, allocation_date, percentage) VALUES ('${asg_1}', '${dateStr}', 100)`);
            }
        }

        // 8. OPERATIONS (Leave, Requests, Interviews, Calendar)
        console.log('8. Seeding Operations...');
        await client.query(`INSERT INTO company_calendar (id, name, date, type) VALUES ('${uuidv4()}', 'Festa della Repubblica', '2024-06-02', 'NATIONAL_HOLIDAY')`);
        
        const lt_ferie = uuidv4();
        await client.query(`INSERT INTO leave_types (id, name, color, requires_approval, affects_capacity) VALUES ('${lt_ferie}', 'Ferie', '#006493', true, true)`);
        await client.query(`INSERT INTO leave_requests (id, resource_id, type_id, start_date, end_date, status, notes) VALUES ('${uuidv4()}', '${res_mario}', '${lt_ferie}', '2024-08-10', '2024-08-20', 'APPROVED', 'Vacanze estive')`);

        const req_id = uuidv4();
        await client.query(`INSERT INTO resource_requests (id, request_code, project_id, role_id, start_date, end_date, commitment_percentage, status, is_urgent) VALUES 
            ('${req_id}', 'REQ-001', '${p_mobile}', '${r_dev}', '2024-06-01', '2024-12-31', 100, 'ATTIVA', true)`);

        await client.query(`INSERT INTO interviews (id, resource_request_id, candidate_name, candidate_surname, status, interview_date) VALUES 
            ('${uuidv4()}', '${req_id}', 'Luca', 'Verdi', 'Aperto', '2024-05-20')`);

        // 9. SYSTEM CONFIG
        console.log('9. Seeding System Config...');
        await client.query(`INSERT INTO app_config (key, value) VALUES 
            ('planning_range_months_before', '6'),
            ('planning_range_months_after', '18'),
            ('skill_threshold.EXPERT', '500'),
            ('theme.db.enabled', 'true')`);

        await client.query(`INSERT INTO notifications (id, recipient_resource_id, title, message, is_read) VALUES 
            ('${uuidv4()}', '${res_mario}', 'Benvenuto', 'Il tuo account è stato attivato correttamente.', false)`);

        console.log('--- Seed Completato con Successo! ---');
        console.log('Account Creati:');
        console.log('- Admin: admin / admin123!');
        console.log('- Manager: elena.bianchi / elena123!');
        console.log('- User: mario.rossi / mario123!');

    } catch (err) {
        console.error('Errore durante il seeding:', err);
        throw err;
    } finally {
        await client.release();
    }
}

main().catch((err) => {
    console.error('An error occurred while attempting to seed the database:', err);
});
