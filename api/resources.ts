/**
 * @file api/resources.ts
 * @description Endpoint API consolidato per la gestione delle operazioni CRUD su varie entità (Risorse, Clienti, Ruoli, etc.).
 * Questa centralizzazione è necessaria per rispettare i limiti sul numero di Serverless Functions del piano Hobby di Vercel.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id, entity } = req.query;

    switch (entity) {
        // --- GESTORE ENTITÀ: RISORSE ---
        case 'resources':
            switch (method) {
                case 'POST':
                    try {
                        const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes, maxStaffingPercentage } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes, max_staffing_percentage)
                            VALUES (${newId}, ${name}, ${email}, ${roleId}, ${horizontal}, ${location}, ${hireDate || null}, ${workSeniority || null}, ${notes || null}, ${maxStaffingPercentage || 100});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'PUT':
                    try {
                        const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes, maxStaffingPercentage } = req.body;
                        await db.sql`
                            UPDATE resources
                            SET name = ${name}, email = ${email}, role_id = ${roleId}, horizontal = ${horizontal}, location = ${location}, 
                                hire_date = ${hireDate || null}, work_seniority = ${workSeniority || null}, notes = ${notes || null}, max_staffing_percentage = ${maxStaffingPercentage || 100}
                            WHERE id = ${id as string};
                        `;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` });}
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'DELETE':
                    const resourceClient = await db.connect();
                    try {
                        await resourceClient.query('BEGIN');
                        const assignmentsRes = await resourceClient.query('SELECT id FROM assignments WHERE resource_id = $1', [id]);
                        const assignmentIds = assignmentsRes.rows.map(r => r.id);
                        if (assignmentIds.length > 0) {
                            await resourceClient.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                        }
                        await resourceClient.query('DELETE FROM assignments WHERE resource_id = $1', [id]);
                        await resourceClient.query('DELETE FROM resources WHERE id = $1', [id]);
                        await resourceClient.query('COMMIT');
                        return res.status(204).end();
                    } catch (error) {
                        await resourceClient.query('ROLLBACK');
                        return res.status(500).json({ error: (error as Error).message });
                    } finally {
                        resourceClient.release();
                    }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }
        
        // --- GESTORE ENTITÀ: CLIENTI ---
        case 'clients':
             switch (method) {
                case 'POST':
                    try {
                        const { name, sector, contactEmail } = req.body;
                        const newId = uuidv4();
                        await db.sql`INSERT INTO clients (id, name, sector, contact_email) VALUES (${newId}, ${name}, ${sector}, ${contactEmail});`;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un cliente con nome '${req.body.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        const { name, sector, contactEmail } = req.body;
                        await db.sql`UPDATE clients SET name = ${name}, sector = ${sector}, contact_email = ${contactEmail} WHERE id = ${id as string};`;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un cliente con nome '${req.body.name}' esiste già.` });}
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        const { rows } = await db.sql`SELECT COUNT(*) FROM projects WHERE client_id = ${id as string};`;
                        if (rows[0].count > 0) { return res.status(409).json({ error: `Impossibile eliminare il cliente. È ancora associato a ${rows[0].count} progetto/i.` }); }
                        await db.sql`DELETE FROM clients WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) { return res.status(500).json({ error: (error as Error).message }); }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        // --- GESTORE ENTITÀ: RUOLI ---
        case 'roles':
            switch (method) {
                case 'POST':
                    try {
                        const { name, seniorityLevel, dailyCost, standardCost } = req.body;
                        const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                        const newId = uuidv4();
                        await db.sql`INSERT INTO roles (id, name, seniority_level, daily_cost, standard_cost, daily_expenses) VALUES (${newId}, ${name}, ${seniorityLevel}, ${dailyCost}, ${standardCost}, ${dailyExpenses});`;
                        return res.status(201).json({ id: newId, ...req.body, dailyExpenses });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un ruolo con nome '${req.body.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        const { name, seniorityLevel, dailyCost, standardCost } = req.body;
                        const dailyExpenses = (Number(dailyCost) || 0) * 0.035;
                        await db.sql`UPDATE roles SET name = ${name}, seniority_level = ${seniorityLevel}, daily_cost = ${dailyCost}, standard_cost = ${standardCost}, daily_expenses = ${dailyExpenses} WHERE id = ${id as string};`;
                        return res.status(200).json({ id, ...req.body, dailyExpenses });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un ruolo con nome '${req.body.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        const { rows } = await db.sql`SELECT COUNT(*) FROM resources WHERE role_id = ${id as string};`;
                        if (rows[0].count > 0) { return res.status(409).json({ error: `Impossibile eliminare il ruolo. È ancora assegnato a ${rows[0].count} risorsa/e.` });}
                        await db.sql`DELETE FROM roles WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) { return res.status(500).json({ error: (error as Error).message });}
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        // --- GESTORE ENTITÀ: PROGETTI ---
        case 'projects':
            switch (method) {
                case 'POST':
                    try {
                        let { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes)
                            VALUES (${newId}, ${name}, ${clientId || null}, ${startDate || null}, ${endDate || null}, ${budget || 0}, ${realizationPercentage || 100}, ${projectManager || null}, ${status || null}, ${notes || null});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un progetto con nome '${req.body.name}' esiste già per questo cliente.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        let { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes } = req.body;
                        await db.sql`
                            UPDATE projects SET name = ${name}, client_id = ${clientId || null}, start_date = ${startDate || null}, end_date = ${endDate || null}, budget = ${budget || 0}, 
                            realization_percentage = ${realizationPercentage || 100}, project_manager = ${projectManager || null}, status = ${status || null}, notes = ${notes || null}
                            WHERE id = ${id as string};
                        `;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un progetto con nome '${req.body.name}' esiste già per questo cliente.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    const projectClient = await db.connect();
                    try {
                        await projectClient.query('BEGIN');
                        const assignmentsRes = await projectClient.query('SELECT id FROM assignments WHERE project_id = $1', [id]);
                        const assignmentIds = assignmentsRes.rows.map(r => r.id);
                        if (assignmentIds.length > 0) {
                            await projectClient.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                        }
                        await projectClient.query('DELETE FROM assignments WHERE project_id = $1', [id]);
                        await projectClient.query('DELETE FROM projects WHERE id = $1', [id]);
                        await projectClient.query('COMMIT');
                        return res.status(204).end();
                    } catch (error) {
                        await projectClient.query('ROLLBACK');
                        return res.status(500).json({ error: (error as Error).message });
                    } finally {
                        projectClient.release();
                    }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }
        
        // --- GESTORE ENTITÀ: CALENDARIO ---
        case 'calendar':
             switch (method) {
                case 'POST':
                    try {
                        let { name, date, type, location } = req.body;
                        const newId = uuidv4();
                        await db.sql`INSERT INTO company_calendar (id, name, date, type, location) VALUES (${newId}, ${name}, ${date}, ${type}, ${type !== 'LOCAL_HOLIDAY' ? null : location});`;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un evento per questa data e sede esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                        let { name, date, type, location } = req.body;
                        await db.sql`UPDATE company_calendar SET name = ${name}, date = ${date}, type = ${type}, location = ${type !== 'LOCAL_HOLIDAY' ? null : location} WHERE id = ${id as string};`;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un evento per questa data e sede esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        await db.sql`DELETE FROM company_calendar WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) { return res.status(500).json({ error: (error as Error).message }); }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        // --- GESTORE ENTITÀ: CANDIDATI ---
        case 'candidates':
            switch(method) {
                case 'POST':
                    try {
                        const { firstName, lastName, birthYear, horizontal, roleId, cvSummary, interviewers, nextInterviewDate, interviewFeedback, notes, entryDate, status, pipelineStatus } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO candidates (id, first_name, last_name, birth_year, horizontal, role_id, cv_summary, interviewers, next_interview_date, interview_feedback, notes, entry_date, status, pipeline_status)
                            VALUES (${newId}, ${firstName}, ${lastName}, ${birthYear || null}, ${horizontal || null}, ${roleId || null}, ${cvSummary || null}, ${interviewers || null}, ${nextInterviewDate || null}, ${interviewFeedback || null}, ${notes || null}, ${entryDate || null}, ${status}, ${pipelineStatus});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'PUT':
                    try {
                         const { firstName, lastName, birthYear, horizontal, roleId, cvSummary, interviewers, nextInterviewDate, interviewFeedback, notes, entryDate, status, pipelineStatus } = req.body;
                        await db.sql`
                            UPDATE candidates SET
                                first_name = ${firstName}, last_name = ${lastName}, birth_year = ${birthYear || null}, horizontal = ${horizontal || null}, role_id = ${roleId || null}, cv_summary = ${cvSummary || null}, 
                                interviewers = ${interviewers || null}, next_interview_date = ${nextInterviewDate || null}, interview_feedback = ${interviewFeedback || null}, notes = ${notes || null}, entry_date = ${entryDate || null}, 
                                status = ${status}, pipeline_status = ${pipelineStatus}
                            WHERE id = ${id as string};
                        `;
                        return res.status(200).json({ id, ...req.body });
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }
                case 'DELETE':
                    try {
                        await db.sql`DELETE FROM candidates WHERE id = ${id as string};`;
                        return res.status(204).end();
                    } catch (error) {
                        return res.status(500).json({ error: (error as Error).message });
                    }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        default:
            return res.status(404).json({ error: `Entity '${entity}' not found.` });
    }
}
