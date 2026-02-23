/**
 * @file api/staffing.ts
 * @description Endpoint API unificato per la gestione delle operazioni di staffing:
 * allocazioni giornaliere e assegnazioni risorsa/progetto.
 *
 * Route:
 *   POST   /api/staffing?action=allocation              → aggiornamento massivo allocazioni (upsert/delete)
 *   POST   /api/staffing?action=assignment              → crea o recupera assegnazione esistente
 *   DELETE /api/staffing?action=assignment&id=<uuid>    → elimina assegnazione con cascade sulle allocazioni
 */

import { db } from './_lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '../utils/webhookNotifier.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { action, id } = req.query;

    if (!action) {
        return res.status(400).json({ error: 'Parametro "action" obbligatorio (allocation | assignment).' });
    }

    // ─── Allocazioni ──────────────────────────────────────────────────────────
    if (action === 'allocation') {
        if (method !== 'POST') {
            res.setHeader('Allow', ['POST']);
            return res.status(405).end();
        }

        const client = await db.connect();
        try {
            const { updates } = req.body;
            if (!Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({ error: 'Campo "updates" obbligatorio e non vuoto.' });
            }

            await client.query('BEGIN');
            const modifiedAssignments = new Set<string>();
            for (const update of updates) {
                const { assignmentId, date, percentage } = update;
                modifiedAssignments.add(assignmentId);
                if (percentage === 0) {
                    await client.query(
                        'DELETE FROM allocations WHERE assignment_id = $1 AND allocation_date = $2',
                        [assignmentId, date]
                    );
                } else {
                    await client.query(
                        'INSERT INTO allocations (assignment_id, allocation_date, percentage) VALUES ($1, $2, $3) ON CONFLICT (assignment_id, allocation_date) DO UPDATE SET percentage = EXCLUDED.percentage',
                        [assignmentId, date, percentage]
                    );
                }
            }
            await client.query('COMMIT');

            for (const assignmentId of modifiedAssignments) {
                const detailsRes = await client.query(
                    `SELECT a.resource_id, r.name AS res_name, p.name AS proj_name
                     FROM assignments a
                     JOIN resources r ON a.resource_id = r.id
                     JOIN projects p ON a.project_id = p.id
                     WHERE a.id = $1`,
                    [assignmentId]
                );
                if (detailsRes.rows.length > 0) {
                    const { resource_id, res_name, proj_name } = detailsRes.rows[0];
                    const count = updates.filter((u: any) => u.assignmentId === assignmentId).length;
                    await notify(client, 'ALLOCATION_CHANGED', {
                        title: 'Allocazione Modificata',
                        color: 'Good',
                        facts: [
                            { name: 'Risorsa', value: res_name },
                            { name: 'Progetto', value: proj_name },
                            { name: 'Giorni', value: count.toString() },
                        ],
                    });
                    if (count > 1) {
                        await client.query(
                            'INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)',
                            [uuidv4(), resource_id, 'Modifica Allocazioni', `Le tue allocazioni sul progetto ${proj_name} sono state aggiornate per ${count} giorni.`, '/workload']
                        );
                    }
                }
            }
            return res.status(200).json({ success: true });
        } catch (error) {
            await client.query('ROLLBACK');
            return res.status(500).json({ error: (error as Error).message });
        } finally {
            client.release();
        }
    }

    // ─── Assegnazioni ─────────────────────────────────────────────────────────
    if (action === 'assignment') {
        if (method === 'POST') {
            const client = await db.connect();
            try {
                const { resourceId, projectId } = req.body;
                const { rows } = await client.query(
                    'SELECT id FROM assignments WHERE resource_id = $1 AND project_id = $2',
                    [resourceId, projectId]
                );
                if (rows.length > 0) {
                    return res.status(200).json({ message: 'Exists', assignment: rows[0] });
                }

                const newId = uuidv4();
                await client.query(
                    'INSERT INTO assignments (id, resource_id, project_id) VALUES ($1, $2, $3)',
                    [newId, resourceId, projectId]
                );

                const detailsRes = await client.query(
                    'SELECT r.name AS res_name, p.name AS proj_name FROM resources r, projects p WHERE r.id = $1 AND p.id = $2',
                    [resourceId, projectId]
                );
                if (detailsRes.rows.length > 0) {
                    const { res_name, proj_name } = detailsRes.rows[0];
                    await notify(client, 'ASSIGNMENT_CREATED', {
                        title: 'Nuova Assegnazione',
                        color: 'Accent',
                        facts: [{ name: 'Risorsa', value: res_name }, { name: 'Progetto', value: proj_name }],
                    });
                    await client.query(
                        'INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)',
                        [uuidv4(), resourceId, 'Nuova Assegnazione', `Sei stato assegnato al progetto ${proj_name}.`, '/staffing']
                    );
                }
                return res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
        }

        if (method === 'DELETE') {
            const client = await db.connect();
            try {
                const detailsRes = await client.query(
                    `SELECT a.resource_id, r.name AS res_name, p.name AS proj_name
                     FROM assignments a
                     JOIN resources r ON a.resource_id = r.id
                     JOIN projects p ON a.project_id = p.id
                     WHERE a.id = $1`,
                    [id]
                );
                await client.query('BEGIN');
                await client.query('DELETE FROM allocations WHERE assignment_id = $1', [id]);
                await client.query('DELETE FROM assignments WHERE id = $1', [id]);
                await client.query('COMMIT');

                if (detailsRes.rows.length > 0) {
                    const { resource_id, res_name, proj_name } = detailsRes.rows[0];
                    await notify(client, 'ASSIGNMENT_DELETED', {
                        title: 'Assegnazione Rimossa',
                        color: 'Warning',
                        facts: [{ name: 'Risorsa', value: res_name }, { name: 'Progetto', value: proj_name }],
                    });
                    await client.query(
                        'INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)',
                        [uuidv4(), resource_id, 'Assegnazione Rimossa', `Sei stato rimosso dal progetto ${proj_name}.`, '/staffing']
                    );
                }
                return res.status(204).end();
            } catch (error) {
                await client.query('ROLLBACK');
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
        }

        return res.status(405).end();
    }

    return res.status(400).json({ error: `Azione non riconosciuta: ${action}. Valori accettati: allocation, assignment.` });
}
