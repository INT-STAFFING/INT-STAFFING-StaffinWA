/**
 * @file api/assignments.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Assegnazioni.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '../utils/webhookNotifier.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;

    const client = await db.connect();

    try {
        switch (method) {
            case 'POST':
                const { resourceId, projectId } = req.body;
                const existing = await client.query(`SELECT id FROM assignments WHERE resource_id = $1 AND project_id = $2`, [resourceId, projectId]);
                if (existing.rows.length > 0) return res.status(200).json({ message: 'Exists', assignment: existing.rows[0] });

                const newId = uuidv4();
                await client.query(`INSERT INTO assignments (id, resource_id, project_id) VALUES ($1, $2, $3)`, [newId, resourceId, projectId]);

                const details = await client.query(`SELECT r.name as res_name, p.name as proj_name FROM resources r, projects p WHERE r.id = $1 AND p.id = $2`, [resourceId, projectId]);
                if (details.rows.length > 0) {
                    const { res_name, proj_name } = details.rows[0];
                    await notify(client, 'ASSIGNMENT_CREATED', { title: 'Nuova Assegnazione', facts: [{ name: 'Risorsa', value: res_name }, { name: 'Progetto', value: proj_name }] });
                    
                    // Internal In-App Notification for the Resource
                    await client.query(
                        `INSERT INTO notifications (id, recipient_resource_id, title, message, link, is_read) 
                         VALUES ($1, $2, $3, $4, $5, false)`,
                        [uuidv4(), resourceId, 'Nuova Assegnazione', `Sei stato assegnato al progetto: ${proj_name}.`, '/staffing']
                    );
                }
                return res.status(201).json({ id: newId, ...req.body });

            case 'DELETE':
                await client.query('BEGIN');
                const old = await client.query(`SELECT r.name as res_name, p.name as proj_name, a.resource_id FROM assignments a JOIN resources r ON a.resource_id = r.id JOIN projects p ON a.project_id = p.id WHERE a.id = $1`, [id]);
                await client.query('DELETE FROM allocations WHERE assignment_id = $1', [id]);
                await client.query('DELETE FROM assignments WHERE id = $1', [id]);
                await client.query('COMMIT');

                if (old.rows.length > 0) {
                    const { res_name, proj_name, resource_id } = old.rows[0];
                    await notify(client, 'ASSIGNMENT_DELETED', { title: 'Assegnazione Rimossa', facts: [{ name: 'Risorsa', value: res_name }, { name: 'Progetto', value: proj_name }] });
                    await client.query(
                        `INSERT INTO notifications (id, recipient_resource_id, title, message, link, is_read) 
                         VALUES ($1, $2, $3, $4, $5, false)`,
                        [uuidv4(), resource_id, 'Assegnazione Rimossa', `Non sei più assegnato al progetto: ${proj_name}.`, '/staffing']
                    );
                }
                return res.status(204).end();

            default:
                res.setHeader('Allow', ['POST', 'DELETE']);
                return res.status(405).end();
        }
    } catch (error) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
