/**
 * @file api/tasks.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Incarichi (Tasks).
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gestore della richiesta API per l'endpoint /api/tasks.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query; // L'ID dell'incarico per le operazioni PUT e DELETE

    switch (method) {
        case 'POST': {
            const client = await db.connect();
            try {
                const { task, assignedResourceIds } = req.body;
                const newId = uuidv4();

                await client.query('BEGIN');

                await client.query(
                    `INSERT INTO tasks (id, wbs, name, project_id, total_fees, internal_fees, external_fees, expenses, realization, margin, role_efforts)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                    [
                        newId, task.wbs, task.name, task.projectId,
                        task.totalFees, task.internalFees, task.externalFees, task.expenses,
                        task.realization, task.margin, JSON.stringify(task.roleEfforts || {})
                    ]
                );

                if (Array.isArray(assignedResourceIds) && assignedResourceIds.length > 0) {
                    for (const resourceId of assignedResourceIds) {
                        await client.query(
                            `INSERT INTO task_resources (task_id, resource_id) VALUES ($1, $2)`,
                            [newId, resourceId]
                        );
                    }
                }

                await client.query('COMMIT');
                return res.status(201).json({ id: newId, ...task });
            } catch (error) {
                await client.query('ROLLBACK');
                 if ((error as any).code === '23505') { // unique_violation
                    return res.status(409).json({ error: `Un incarico con WBS '${req.body.task.wbs}' o nome '${req.body.task.name}' esiste già.` });
                }
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
        }

        case 'PUT': {
            const client = await db.connect();
            try {
                const { task, assignedResourceIds } = req.body;
                
                await client.query('BEGIN');

                await client.query(
                    `UPDATE tasks SET 
                        wbs = $1, name = $2, project_id = $3, total_fees = $4, internal_fees = $5, 
                        external_fees = $6, expenses = $7, realization = $8, margin = $9, role_efforts = $10
                     WHERE id = $11`,
                    [
                        task.wbs, task.name, task.projectId,
                        task.totalFees, task.internalFees, task.externalFees, task.expenses,
                        task.realization, task.margin, JSON.stringify(task.roleEfforts || {}),
                        id as string
                    ]
                );

                // Sincronizza le risorse assegnate
                await client.query('DELETE FROM task_resources WHERE task_id = $1', [id]);
                if (Array.isArray(assignedResourceIds) && assignedResourceIds.length > 0) {
                    for (const resourceId of assignedResourceIds) {
                        await client.query(
                            `INSERT INTO task_resources (task_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                            [id, resourceId]
                        );
                    }
                }
                
                await client.query('COMMIT');
                return res.status(200).json({ id, ...task });
            } catch (error) {
                await client.query('ROLLBACK');
                 if ((error as any).code === '23505') {
                    return res.status(409).json({ error: `Un incarico con WBS '${req.body.task.wbs}' o nome '${req.body.task.name}' esiste già.` });
                }
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
        }

        case 'DELETE': {
            const client = await db.connect();
            try {
                await client.query('BEGIN');
                // L'eliminazione a cascata definita nello schema si occuperà di `task_resources`.
                await client.query('DELETE FROM tasks WHERE id = $1', [id as string]);
                await client.query('COMMIT');
                return res.status(204).end();
            } catch (error) {
                await client.query('ROLLBACK');
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
        }
            
        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}