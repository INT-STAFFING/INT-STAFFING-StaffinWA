
/**
 * @file api/resources.ts
 * @description Endpoint API unificato per la gestione delle risorse (CRUD) e altre entità.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// WHITELIST per db_inspector per prevenire SQL Injection
const ALLOWED_TABLES = new Set([
    'horizontals', 'seniority_levels', 'project_statuses', 'client_sectors', 'locations', 
    'app_config', 'clients', 'roles', 'resources', 'contracts', 'projects', 'resource_requests',
    'interviews', 'wbs_tasks', 'company_calendar', 'assignments', 'contract_projects', 
    'contract_managers', 'allocations', 'skills', 'resource_skills', 'project_skills', 'role_cost_history',
    'leave_types', 'leave_requests', 'app_users', 'role_permissions'
]);

const JWT_SECRET = process.env.JWT_SECRET || 'staffing-app-secret-key-change-in-prod';

// Middleware per verificare se l'utente è admin
const verifyAdmin = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    
    const token = authHeader.split(' ')[1];
    if (!token) return false;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return decoded.role === 'ADMIN';
    } catch (error) {
        return false;
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { entity, id, action } = req.query;

    if (!entity) {
        return res.status(400).json({ error: 'Entity parameter is required' });
    }

    const client = await db.connect();

    try {
        switch (entity) {
            // --- EMERGENCY RESET ---
            case 'emergency_reset':
                if (method === 'POST') {
                    // Questo endpoint è pubblico ma dovrebbe essere rimosso in produzione reale
                    // Serve per sbloccare l'utente admin su Vercel senza accesso shell.
                    
                    const salt = await bcrypt.genSalt(10);
                    const hash = await bcrypt.hash('admin', salt);
                    const newId = uuidv4();

                    await client.query('BEGIN');
                    // Rimuove il vecchio admin (se esiste)
                    await client.sql`DELETE FROM app_users WHERE username = 'admin'`;
                    // Crea il nuovo admin
                    await client.sql`
                        INSERT INTO app_users (id, username, password_hash, role, is_active)
                        VALUES (${newId}, 'admin', ${hash}, 'ADMIN', TRUE)
                    `;
                    await client.query('COMMIT');
                    
                    return res.status(200).json({ success: true, message: 'Admin user reset to default (admin/admin)' });
                }
                break;

            // --- USERS & AUTH ---
            case 'app-users':
                // Protezione: Solo Admin può gestire utenti
                if (!verifyAdmin(req)) {
                    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
                }

                if (method === 'GET') {
                    // List users (securely)
                    const { rows } = await client.sql`
                        SELECT u.id, u.username, u.role, u.is_active, u.resource_id, u.created_at, r.name as resource_name 
                        FROM app_users u
                        LEFT JOIN resources r ON u.resource_id = r.id
                        ORDER BY u.username ASC
                    `;
                    return res.status(200).json(rows);
                } else if (method === 'POST') {
                    // Create User
                    const { username, password, role, resourceId, isActive } = req.body;
                    if (!username || !password) return res.status(400).json({error: 'Username/Password required'});
                    
                    // Check existing
                    const exists = await client.sql`SELECT id FROM app_users WHERE username=${username}`;
                    if (exists.rows.length > 0) return res.status(400).json({error: 'Username already exists'});

                    const salt = await bcrypt.genSalt(10);
                    const hash = await bcrypt.hash(password, salt);
                    const newId = uuidv4();

                    await client.sql`
                        INSERT INTO app_users (id, username, password_hash, role, resource_id, is_active)
                        VALUES (${newId}, ${username}, ${hash}, ${role || 'SIMPLE'}, ${resourceId || null}, ${isActive ?? true})
                    `;
                    return res.status(201).json({ id: newId, username, role });

                } else if (method === 'PUT') {
                    if (action === 'change_password') {
                        // Self-service or Admin forced password change
                        // TODO: For self-service, we should verify the token ID matches the requested ID or is Admin
                        // For now, relying on verifyAdmin check above (so only Admin can change passwords via this route)
                        const { newPassword } = req.body;
                        if (!newPassword) return res.status(400).json({error: 'New password required'});
                        
                        const salt = await bcrypt.genSalt(10);
                        const hash = await bcrypt.hash(newPassword, salt);
                        
                        await client.sql`UPDATE app_users SET password_hash=${hash} WHERE id=${id as string}`;
                        return res.status(200).json({ success: true });
                    } else {
                        // Update details
                        const { role, resourceId, isActive, password } = req.body;
                        
                        // Build dynamic query updates
                        // If password provided, hash it
                        let hash = undefined;
                        if (password) {
                            const salt = await bcrypt.genSalt(10);
                            hash = await bcrypt.hash(password, salt);
                        }

                        await client.sql`
                            UPDATE app_users SET 
                                role = COALESCE(${role}, role),
                                resource_id = ${resourceId === undefined ? null : resourceId},
                                is_active = COALESCE(${isActive}, is_active),
                                password_hash = COALESCE(${hash}, password_hash)
                            WHERE id = ${id as string}
                        `;
                        return res.status(200).json({ id, ...req.body, password: '***' });
                    }
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM app_users WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

            case 'role-permissions':
                if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });

                if (method === 'GET') {
                    const { rows } = await client.sql`SELECT * FROM role_permissions`;
                    return res.status(200).json(rows);
                } else if (method === 'POST') {
                    // Bulk update permissions
                    const { permissions } = req.body; // Array of { role, pagePath, isAllowed }
                    await client.query('BEGIN');
                    for (const p of permissions) {
                        await client.sql`
                            INSERT INTO role_permissions (role, page_path, is_allowed)
                            VALUES (${p.role}, ${p.pagePath}, ${p.isAllowed})
                            ON CONFLICT (role, page_path) 
                            DO UPDATE SET is_allowed = EXCLUDED.is_allowed
                        `;
                    }
                    await client.query('COMMIT');
                    return res.status(200).json({ success: true });
                }
                break;

            // --- CLIENTS ---
            case 'clients':
                if (method === 'POST') {
                    const { name, sector, contactEmail } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO clients (id, name, sector, contact_email) VALUES (${newId}, ${name}, ${sector}, ${contactEmail})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'PUT') {
                    const { name, sector, contactEmail } = req.body;
                    await client.sql`UPDATE clients SET name=${name}, sector=${sector}, contact_email=${contactEmail} WHERE id=${id as string}`;
                    return res.status(200).json({ id, ...req.body });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM clients WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

            // --- ROLES ---
            case 'roles':
                if (method === 'POST') {
                    const { name, seniorityLevel, dailyCost, standardCost } = req.body;
                    const newId = uuidv4();
                    const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                    
                    await client.query('BEGIN');
                    await client.sql`INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES (${newId}, ${name}, ${seniorityLevel}, ${dailyCost}, ${standardCost}, ${dailyExpenses})`;
                    // Create initial history record
                    const historyId = uuidv4();
                    const startDate = new Date().toISOString().split('T')[0];
                    await client.sql`INSERT INTO role_cost_history (id, role_id, daily_cost, start_date) VALUES (${historyId}, ${newId}, ${dailyCost}, ${startDate})`;
                    await client.query('COMMIT');
                    
                    return res.status(201).json({ id: newId, ...req.body, dailyExpenses });
                } else if (method === 'PUT') {
                    const { name, seniorityLevel, dailyCost, standardCost } = req.body;
                    const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                    
                    // Check if cost changed for history tracking
                    const currentRole = await client.sql`SELECT daily_cost FROM roles WHERE id=${id as string}`;
                    const oldCost = currentRole.rows[0]?.daily_cost;
                    
                    await client.query('BEGIN');
                    await client.sql`UPDATE roles SET name=${name}, seniority_level=${seniorityLevel}, daily_cost=${dailyCost}, standard_cost=${standardCost}, daily_expenses=${dailyExpenses} WHERE id=${id as string}`;
                    
                    if (Number(oldCost) !== Number(dailyCost)) {
                        // Close previous history
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yesterdayStr = yesterday.toISOString().split('T')[0];
                        const todayStr = new Date().toISOString().split('T')[0];
                        
                        await client.sql`UPDATE role_cost_history SET end_date=${yesterdayStr} WHERE role_id=${id as string} AND end_date IS NULL`;
                        
                        // Insert new history
                        const historyId = uuidv4();
                        await client.sql`INSERT INTO role_cost_history (id, role_id, daily_cost, start_date) VALUES (${historyId}, ${id as string}, ${dailyCost}, ${todayStr})`;
                    }
                    await client.query('COMMIT');

                    return res.status(200).json({ id, ...req.body, dailyExpenses });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM roles WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

            // --- RESOURCES ---
            case 'resources':
                 if (method === 'POST') {
                    const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes, maxStaffingPercentage, resigned, lastDayOfWork } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes, max_staffing_percentage, resigned, last_day_of_work) 
                                     VALUES (${newId}, ${name}, ${email}, ${roleId}, ${horizontal}, ${location}, ${hireDate}, ${workSeniority}, ${notes}, ${maxStaffingPercentage}, ${resigned}, ${lastDayOfWork})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'PUT') {
                     const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes, maxStaffingPercentage, resigned, lastDayOfWork } = req.body;
                     await client.sql`UPDATE resources SET name=${name}, email=${email}, role_id=${roleId}, horizontal=${horizontal}, location=${location}, hire_date=${hireDate}, work_seniority=${workSeniority}, notes=${notes}, max_staffing_percentage=${maxStaffingPercentage}, resigned=${resigned}, last_day_of_work=${lastDayOfWork} WHERE id=${id as string}`;
                     return res.status(200).json({ id, ...req.body });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM resources WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

            // --- PROJECTS ---
            case 'projects':
                if (method === 'POST') {
                    const { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes, contractId } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes, contract_id) 
                                     VALUES (${newId}, ${name}, ${clientId}, ${startDate}, ${endDate}, ${budget}, ${realizationPercentage}, ${projectManager}, ${status}, ${notes}, ${contractId})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'PUT') {
                    const { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes, contractId } = req.body;
                    await client.sql`UPDATE projects SET name=${name}, client_id=${clientId}, start_date=${startDate}, end_date=${endDate}, budget=${budget}, realization_percentage=${realizationPercentage}, project_manager=${projectManager}, status=${status}, notes=${notes}, contract_id=${contractId} WHERE id=${id as string}`;
                    return res.status(200).json({ id, ...req.body });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM projects WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

            // --- ASSIGNMENTS ---
            case 'assignments':
                if (method === 'POST') {
                    const { resourceId, projectId } = req.body;
                    const { rows } = await client.sql`SELECT id FROM assignments WHERE resource_id = ${resourceId} AND project_id = ${projectId}`;
                    if (rows.length > 0) {
                         return res.status(200).json({ message: 'Assignment already exists.', id: rows[0].id });
                    }
                    const newId = uuidv4();
                    await client.sql`INSERT INTO assignments (id, resource_id, project_id) VALUES (${newId}, ${resourceId}, ${projectId})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'DELETE') {
                    await client.query('BEGIN');
                    await client.sql`DELETE FROM allocations WHERE assignment_id = ${id as string}`;
                    await client.sql`DELETE FROM assignments WHERE id = ${id as string}`;
                    await client.query('COMMIT');
                    return res.status(204).end();
                }
                break;
            
             // --- ALLOCATIONS ---
            case 'allocations':
                if (method === 'POST') {
                    const { updates } = req.body;
                    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid updates format' });
                    
                    await client.query('BEGIN');
                    for (const update of updates) {
                         const { assignmentId, date, percentage } = update;
                         if (percentage === 0) {
                            await client.sql`DELETE FROM allocations WHERE assignment_id = ${assignmentId} AND allocation_date = ${date}`;
                         } else {
                            await client.sql`INSERT INTO allocations (assignment_id, allocation_date, percentage) VALUES (${assignmentId}, ${date}, ${percentage})
                                             ON CONFLICT (assignment_id, allocation_date) DO UPDATE SET percentage = EXCLUDED.percentage`;
                         }
                    }
                    await client.query('COMMIT');
                    return res.status(200).json({ message: 'Allocations updated' });
                }
                break;

            // --- CALENDAR ---
            case 'calendar':
                 if (method === 'POST') {
                    const { name, date, type, location } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO company_calendar (id, name, date, type, location) VALUES (${newId}, ${name}, ${date}, ${type}, ${location})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'PUT') {
                    const { name, date, type, location } = req.body;
                    await client.sql`UPDATE company_calendar SET name=${name}, date=${date}, type=${type}, location=${location} WHERE id=${id as string}`;
                    return res.status(200).json({ id, ...req.body });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM company_calendar WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

             // --- CONTRACTS ---
            case 'contracts':
                if (action === 'recalculate_backlog' && id) {
                     // Backlog Calculation Logic
                     const contractRes = await client.sql`SELECT capienza FROM contracts WHERE id=${id as string}`;
                     if (contractRes.rows.length === 0) return res.status(404).json({error: 'Contract not found'});
                     
                     const capienza = Number(contractRes.rows[0].capienza);
                     
                     const projectsRes = await client.sql`
                        SELECT p.budget FROM projects p 
                        JOIN contract_projects cp ON p.id = cp.project_id 
                        WHERE cp.contract_id = ${id as string}
                     `;
                     
                     const totalAllocated = projectsRes.rows.reduce((sum, row) => sum + Number(row.budget || 0), 0);
                     const backlog = capienza - totalAllocated;
                     
                     await client.sql`UPDATE contracts SET backlog=${backlog} WHERE id=${id as string}`;
                     const updated = await client.sql`SELECT * FROM contracts WHERE id=${id as string}`;
                     return res.status(200).json(updated.rows[0]);
                }

                if (method === 'POST') {
                    const { name, startDate, endDate, cig, cigDerivato, capienza, projectIds, managerIds } = req.body;
                    const newId = uuidv4();
                    
                    await client.query('BEGIN');
                    await client.sql`INSERT INTO contracts (id, name, start_date, end_date, cig, cig_derivato, capienza, backlog) 
                                     VALUES (${newId}, ${name}, ${startDate}, ${endDate}, ${cig}, ${cigDerivato}, ${capienza}, ${capienza})`; // Initial backlog = capienza

                    if (projectIds && projectIds.length > 0) {
                         for(const pid of projectIds) {
                             await client.sql`INSERT INTO contract_projects (contract_id, project_id) VALUES (${newId}, ${pid})`;
                             // Also link project to contract directly
                             await client.sql`UPDATE projects SET contract_id=${newId} WHERE id=${pid}`;
                         }
                    }
                    if (managerIds && managerIds.length > 0) {
                        for(const mid of managerIds) {
                             await client.sql`INSERT INTO contract_managers (contract_id, resource_id) VALUES (${newId}, ${mid})`;
                        }
                    }
                    await client.query('COMMIT');
                    return res.status(201).json({ id: newId, ...req.body });

                } else if (method === 'PUT') {
                     const { name, startDate, endDate, cig, cigDerivato, capienza, projectIds, managerIds } = req.body;
                     
                     await client.query('BEGIN');
                     await client.sql`UPDATE contracts SET name=${name}, start_date=${startDate}, end_date=${endDate}, cig=${cig}, cig_derivato=${cigDerivato}, capienza=${capienza} WHERE id=${id as string}`;
                     
                     // Update relations
                     await client.sql`DELETE FROM contract_projects WHERE contract_id=${id as string}`;
                     await client.sql`UPDATE projects SET contract_id=NULL WHERE contract_id=${id as string}`; // Unlink old
                     if (projectIds && projectIds.length > 0) {
                         for(const pid of projectIds) {
                             await client.sql`INSERT INTO contract_projects (contract_id, project_id) VALUES (${id as string}, ${pid})`;
                             await client.sql`UPDATE projects SET contract_id=${id as string} WHERE id=${pid}`; // Link new
                         }
                     }
                     
                     await client.sql`DELETE FROM contract_managers WHERE contract_id=${id as string}`;
                     if (managerIds && managerIds.length > 0) {
                         for(const mid of managerIds) {
                             await client.sql`INSERT INTO contract_managers (contract_id, resource_id) VALUES (${id as string}, ${mid})`;
                         }
                     }
                     await client.query('COMMIT');
                     return res.status(200).json({ id, ...req.body });

                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM contracts WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

            // --- SKILLS & ASSOCIATIONS ---
            case 'skills':
                if (method === 'POST') {
                    const { name, category } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO skills (id, name, category) VALUES (${newId}, ${name}, ${category})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'PUT') {
                     const { name, category } = req.body;
                     await client.sql`UPDATE skills SET name=${name}, category=${category} WHERE id=${id as string}`;
                     return res.status(200).json({ id, ...req.body });
                } else if (method === 'DELETE') {
                     await client.sql`DELETE FROM skills WHERE id=${id as string}`;
                     return res.status(204).end();
                }
                break;
            
            case 'resource-skills':
                 if (method === 'POST') {
                    const { resourceId, skillId, level, acquisitionDate, expirationDate } = req.body;
                    await client.sql`INSERT INTO resource_skills (resource_id, skill_id, level, acquisition_date, expiration_date) 
                                     VALUES (${resourceId}, ${skillId}, ${level}, ${acquisitionDate}, ${expirationDate})
                                     ON CONFLICT (resource_id, skill_id) DO UPDATE SET 
                                     level=EXCLUDED.level, acquisition_date=EXCLUDED.acquisition_date, expiration_date=EXCLUDED.expiration_date`;
                    return res.status(200).json({ success: true });
                 } else if (method === 'DELETE') {
                     const { resourceId, skillId } = req.query;
                     await client.sql`DELETE FROM resource_skills WHERE resource_id=${resourceId as string} AND skill_id=${skillId as string}`;
                     return res.status(204).end();
                 }
                 break;

            case 'project-skills':
                 if (method === 'POST') {
                    const { projectId, skillId } = req.body;
                    await client.sql`INSERT INTO project_skills (project_id, skill_id) VALUES (${projectId}, ${skillId}) ON CONFLICT DO NOTHING`;
                    return res.status(200).json({ success: true });
                 } else if (method === 'DELETE') {
                    const { projectId, skillId } = req.query;
                    await client.sql`DELETE FROM project_skills WHERE project_id=${projectId as string} AND skill_id=${skillId as string}`;
                    return res.status(204).end();
                 }
                 break;
            
            case 'skill-thresholds':
                if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
                if (method === 'POST') {
                     const { thresholds } = req.body;
                     await client.query('BEGIN');
                     for (const [key, value] of Object.entries(thresholds)) {
                        await client.sql`INSERT INTO app_config (key, value) VALUES (${`skill_threshold.${key}`}, ${String(value)}) 
                                         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
                     }
                     await client.query('COMMIT');
                     return res.status(200).json({ success: true });
                }
                break;

            // --- RESOURCE REQUESTS ---
            case 'resource-requests':
                 if (method === 'POST') {
                    const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, notes, status } = req.body;
                    const newId = uuidv4();
                    
                    // Generate request code
                    const lastCodeRes = await client.sql`SELECT request_code FROM resource_requests WHERE request_code IS NOT NULL ORDER BY request_code DESC LIMIT 1`;
                    let lastNumber = 0;
                    if (lastCodeRes.rows.length > 0) {
                        lastNumber = parseInt(lastCodeRes.rows[0].request_code.replace('HCR', ''), 10);
                    }
                    const requestCode = `HCR${String(lastNumber + 1).padStart(5, '0')}`;

                    await client.sql`INSERT INTO resource_requests (id, request_code, project_id, role_id, requestor_id, start_date, end_date, commitment_percentage, is_urgent, is_long_term, is_tech_request, notes, status) 
                                     VALUES (${newId}, ${requestCode}, ${projectId}, ${roleId}, ${requestorId}, ${startDate}, ${endDate}, ${commitmentPercentage}, ${isUrgent}, ${isLongTerm}, ${isTechRequest}, ${notes}, ${status})`;
                    return res.status(201).json({ id: newId, requestCode, ...req.body });
                 } else if (method === 'PUT') {
                     const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, notes, status } = req.body;
                     await client.sql`UPDATE resource_requests SET project_id=${projectId}, role_id=${roleId}, requestor_id=${requestorId}, start_date=${startDate}, end_date=${endDate}, commitment_percentage=${commitmentPercentage}, is_urgent=${isUrgent}, is_long_term=${isLongTerm}, is_tech_request=${isTechRequest}, notes=${notes}, status=${status} WHERE id=${id as string}`;
                     return res.status(200).json({ id, ...req.body });
                 } else if (method === 'DELETE') {
                     await client.sql`DELETE FROM resource_requests WHERE id=${id as string}`;
                     return res.status(204).end();
                 }
                 break;

            // --- INTERVIEWS ---
            case 'interviews':
                 if (method === 'POST') {
                    const { resourceRequestId, candidateName, candidateSurname, birthDate, horizontal, roleId, cvSummary, interviewersIds, interviewDate, feedback, notes, hiringStatus, entryDate, status } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO interviews (id, resource_request_id, candidate_name, candidate_surname, birth_date, horizontal, role_id, cv_summary, interviewers_ids, interview_date, feedback, notes, hiring_status, entry_date, status)
                                     VALUES (${newId}, ${resourceRequestId}, ${candidateName}, ${candidateSurname}, ${birthDate}, ${horizontal}, ${roleId}, ${cvSummary}, ${interviewersIds}, ${interviewDate}, ${feedback}, ${notes}, ${hiringStatus}, ${entryDate}, ${status})`;
                    return res.status(201).json({ id: newId, ...req.body });
                 } else if (method === 'PUT') {
                    const { resourceRequestId, candidateName, candidateSurname, birthDate, horizontal, roleId, cvSummary, interviewersIds, interviewDate, feedback, notes, hiringStatus, entryDate, status } = req.body;
                    await client.sql`UPDATE interviews SET resource_request_id=${resourceRequestId}, candidate_name=${candidateName}, candidate_surname=${candidateSurname}, birth_date=${birthDate}, horizontal=${horizontal}, role_id=${roleId}, cv_summary=${cvSummary}, interviewers_ids=${interviewersIds}, interview_date=${interviewDate}, feedback=${feedback}, notes=${notes}, hiring_status=${hiringStatus}, entry_date=${entryDate}, status=${status} WHERE id=${id as string}`;
                    return res.status(200).json({ id, ...req.body });
                 } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM interviews WHERE id=${id as string}`;
                    return res.status(204).end();
                 }
                 break;

             // --- WBS TASKS ---
             case 'wbsTasks':
                if (method === 'POST') {
                    const task = req.body;
                    const newId = uuidv4();
                     await client.sql`INSERT INTO wbs_tasks (id, elemento_wbs, descrizione_wbe, client_id, periodo, ore, produzione_lorda, ore_network_italia, produzione_lorda_network_italia, perdite, realisation, spese_onorari_esterni, spese_altro, fatture_onorari, fatture_spese, iva, incassi, primo_responsabile_id, secondo_responsabile_id)
                     VALUES (${newId}, ${task.elementoWbs}, ${task.descrizioneWbe}, ${task.clientId}, ${task.periodo}, ${task.ore}, ${task.produzioneLorda}, ${task.oreNetworkItalia}, ${task.produzioneLordaNetworkItalia}, ${task.perdite}, ${task.realisation}, ${task.speseOnorariEsterni}, ${task.speseAltro}, ${task.fattureOnorari}, ${task.fattureSpese}, ${task.iva}, ${task.incassi}, ${task.primoResponsabile_id}, ${task.secondoResponsabile_id})`;
                     return res.status(201).json({ id: newId, ...task });
                } else if (method === 'PUT') {
                    const task = req.body;
                    await client.sql`UPDATE wbs_tasks SET elemento_wbs=${task.elementoWbs}, descrizione_wbe=${task.descrizioneWbe}, client_id=${task.clientId}, periodo=${task.periodo}, ore=${task.ore}, produzione_lorda=${task.produzioneLorda}, ore_network_italia=${task.oreNetworkItalia}, produzione_lorda_network_italia=${task.produzioneLordaNetworkItalia}, perdite=${task.perdite}, realisation=${task.realisation}, spese_onorari_esterni=${task.spese_onorari_esterni}, spese_altro=${task.speseAltro}, fatture_onorari=${task.fattureOnorari}, fatture_spese=${task.fattureSpese}, iva=${task.iva}, incassi=${task.incassi}, primo_responsabile_id=${task.primoResponsabileId}, secondo_responsabile_id=${task.secondoResponsabileId} WHERE id=${id as string}`;
                    return res.status(200).json({ id, ...task });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM wbs_tasks WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

             // --- PAGE VISIBILITY ---
             case 'page-visibility':
                if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
                if (method === 'POST') {
                    const { path, restricted } = req.body;
                    await client.sql`INSERT INTO app_config (key, value) VALUES (${`page_vis.${path}`}, ${restricted ? 'true' : 'false'}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
                    return res.status(200).json({ success: true });
                }
                break;

             // --- THEME ---
             case 'theme':
                 if (method === 'GET') {
                     const result = await client.sql`SELECT key, value FROM app_config WHERE key LIKE 'theme.%'`;
                     return res.status(200).json(result.rows);
                 } else if (method === 'POST') {
                     const { updates } = req.body;
                     await client.query('BEGIN');
                     for (const [key, value] of Object.entries(updates)) {
                        await client.sql`INSERT INTO app_config (key, value) VALUES (${key}, ${String(value)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
                     }
                     await client.query('COMMIT');
                     return res.status(200).json({ success: true });
                 }
                 break;

            // --- LEAVE TYPES ---
            case 'leave-types':
                if (method === 'POST') {
                    const { name, color, requiresApproval, affectsCapacity } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO leave_types (id, name, color, requires_approval, affects_capacity) VALUES (${newId}, ${name}, ${color}, ${requiresApproval}, ${affectsCapacity})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'PUT') {
                    const { name, color, requiresApproval, affectsCapacity } = req.body;
                    await client.sql`UPDATE leave_types SET name=${name}, color=${color}, requires_approval=${requiresApproval}, affects_capacity=${affectsCapacity} WHERE id=${id as string}`;
                    return res.status(200).json({ id, ...req.body });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM leave_types WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;

            // --- LEAVE REQUESTS ---
            case 'leaves':
                if (method === 'POST') {
                    const { resourceId, typeId, startDate, endDate, status, managerId, notes } = req.body;
                    const newId = uuidv4();
                    await client.sql`INSERT INTO leave_requests (id, resource_id, type_id, start_date, end_date, status, manager_id, notes) 
                                     VALUES (${newId}, ${resourceId}, ${typeId}, ${startDate}, ${endDate}, ${status}, ${managerId}, ${notes})`;
                    return res.status(201).json({ id: newId, ...req.body });
                } else if (method === 'PUT') {
                    const { resourceId, typeId, startDate, endDate, status, managerId, notes } = req.body;
                    await client.sql`UPDATE leave_requests SET resource_id=${resourceId}, type_id=${typeId}, start_date=${startDate}, end_date=${endDate}, status=${status}, manager_id=${managerId}, notes=${notes} WHERE id=${id as string}`;
                    return res.status(200).json({ id, ...req.body });
                } else if (method === 'DELETE') {
                    await client.sql`DELETE FROM leave_requests WHERE id=${id as string}`;
                    return res.status(204).end();
                }
                break;
            
            // --- DB INSPECTOR ---
            case 'db_inspector':
                // Protezione: Solo Admin (ma ALLOWED_TABLES protegge le query)
                if (!verifyAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });

                if (action === 'list_tables') {
                     const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
                     // Filter results using the whitelist to only show safe tables
                     const safeTables = result.rows
                         .map((r: any) => r.table_name)
                         .filter((t: string) => ALLOWED_TABLES.has(t));
                     return res.status(200).json(safeTables);
                } else if (action === 'get_table_data') {
                     const table = req.query.table as string;
                     
                     // SECURITY: Whitelist validation
                     if (!ALLOWED_TABLES.has(table)) {
                         return res.status(400).json({error: 'Invalid table'});
                     }
                     
                     const columns = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [table]);
                     const rows = await client.query(`SELECT * FROM "${table}" LIMIT 100`); // Using quote for safety even if whitelisted
                     return res.status(200).json({ columns: columns.rows, rows: rows.rows });
                } else if (action === 'update_row') {
                    const table = req.query.table as string;
                    // SECURITY: Whitelist validation
                    if (!ALLOWED_TABLES.has(table)) {
                         return res.status(400).json({error: 'Invalid table'});
                    }

                    const updates = req.body;
                    const rowId = req.query.id as string;
                    
                    const columns = Object.keys(updates);
                    if (columns.length === 0) return res.status(400).json({error: 'No updates provided'});

                    // Construct query with parameters
                    const setClause = columns.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
                    const values = Object.values(updates);
                    
                    // Using quote for table name safely because it's whitelisted
                    await client.query(`UPDATE "${table}" SET ${setClause} WHERE id = $1`, [rowId, ...values]);
                    return res.status(200).json({ success: true });

                } else if (action === 'delete_all_rows') {
                    const table = req.query.table as string;
                    // SECURITY: Whitelist validation
                    if (!ALLOWED_TABLES.has(table)) {
                         return res.status(400).json({error: 'Invalid table'});
                    }
                    await client.query(`DELETE FROM "${table}"`);
                    return res.status(200).json({ success: true });
                } else if (action === 'export_sql') {
                    const exportHandler = (await import('./export-sql.js')).default;
                    return exportHandler(req, res);
                }
                break;

            default:
                return res.status(400).json({ error: 'Unknown entity' });
        }
    } catch (error) {
        await client.query('ROLLBACK'); // Safe to call even if no transaction active
        console.error('API Error:', error);
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
    
    // Fallback if no response sent
    if (!res.writableEnded) {
        return res.status(405).end(`Method ${method} Not Allowed or Action Not Found`);
    }
}
