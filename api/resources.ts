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
                        const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes } = req.body;
                        const newId = uuidv4();
                        await db.sql`
                            INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes)
                            VALUES (${newId}, ${name}, ${email}, ${roleId}, ${horizontal}, ${location}, ${hireDate}, ${workSeniority}, ${notes});
                        `;
                        return res.status(201).json({ id: newId, ...req.body });
                    } catch (error) {
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    }

                case 'PUT':
                    try {
                        const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes } = req.body;
                        await db.sql`
                            UPDATE resources
                            SET name = ${name}, email = ${email}, role_id = ${roleId}, horizontal = ${horizontal}, location = ${location}, 
                                hire_date = ${hireDate}, work_seniority = ${workSeniority}, notes = ${notes}
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
        
        // --- GESTORE ENTITÀ: INCARICHI (TASKS) ---
        case 'tasks':
            const taskClient = await db.connect();
             switch (method) {
                case 'POST':
                    try {
                        const { task, assignedResourceIds } = req.body;
                        const newId = uuidv4();
                        await taskClient.query('BEGIN');
                        await taskClient.query(`INSERT INTO tasks (id, wbs, name, project_id, total_fees, internal_fees, external_fees, expenses, realization, margin, role_efforts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                            [newId, task.wbs, task.name, task.projectId, task.totalFees, task.internalFees, task.externalFees, task.expenses, task.realization, task.margin, JSON.stringify(task.roleEfforts || {})]
                        );
                        if (Array.isArray(assignedResourceIds) && assignedResourceIds.length > 0) {
                            for (const resourceId of assignedResourceIds) {
                                await taskClient.query(`INSERT INTO task_resources (task_id, resource_id) VALUES ($1, $2)`, [newId, resourceId]);
                            }
                        }
                        await taskClient.query('COMMIT');
                        return res.status(201).json({ id: newId, ...task });
                    } catch (error) {
                        await taskClient.query('ROLLBACK');
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un incarico con WBS '${req.body.task.wbs}' o nome '${req.body.task.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    } finally { taskClient.release(); }
                case 'PUT':
                     try {
                        const { task, assignedResourceIds } = req.body;
                        await taskClient.query('BEGIN');
                        await taskClient.query(`UPDATE tasks SET wbs = $1, name = $2, project_id = $3, total_fees = $4, internal_fees = $5, external_fees = $6, expenses = $7, realization = $8, margin = $9, role_efforts = $10 WHERE id = $11`,
                            [task.wbs, task.name, task.projectId, task.totalFees, task.internalFees, task.externalFees, task.expenses, task.realization, task.margin, JSON.stringify(task.roleEfforts || {}), id as string]
                        );
                        await taskClient.query('DELETE FROM task_resources WHERE task_id = $1', [id]);
                        if (Array.isArray(assignedResourceIds) && assignedResourceIds.length > 0) {
                            for (const resourceId of assignedResourceIds) {
                                await taskClient.query(`INSERT INTO task_resources (task_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, resourceId]);
                            }
                        }
                        await taskClient.query('COMMIT');
                        return res.status(200).json({ id, ...task });
                    } catch (error) {
                        await taskClient.query('ROLLBACK');
                        if ((error as any).code === '23505') { return res.status(409).json({ error: `Un incarico con WBS '${req.body.task.wbs}' o nome '${req.body.task.name}' esiste già.` }); }
                        return res.status(500).json({ error: (error as Error).message });
                    } finally { taskClient.release(); }
                case 'DELETE':
                     try {
                        await taskClient.query('BEGIN');
                        await taskClient.query('DELETE FROM tasks WHERE id = $1', [id as string]);
                        await taskClient.query('COMMIT');
                        return res.status(204).end();
                    } catch (error) {
                        await taskClient.query('ROLLBACK');
                        return res.status(500).json({ error: (error as Error).message });
                    } finally { taskClient.release(); }
                default:
                    res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
                    return res.status(405).end(`Method ${method} Not Allowed`);
            }

        default:
            return res.status(400).json({ error: 'Invalid or missing entity type specified' });
    }
}
