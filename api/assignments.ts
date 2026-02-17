/**
 * @file api/assignments.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Assegnazioni.
 */

import { db } from './_lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '../utils/webhookNotifier.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;

    switch (method) {
        case 'POST':
            const client = await db.connect();
            try {
                const { resourceId, projectId } = req.body;
                const { rows } = await client.query(`SELECT id FROM assignments WHERE resource_id = $1 AND project_id = $2`, [resourceId, projectId]);
                if (rows.length > 0) return res.status(200).json({ message: 'Exists', assignment: rows[0] });

                const newId = uuidv4();
                await client.query(`INSERT INTO assignments (id, resource_id, project_id) VALUES ($1, $2, $3)`, [newId, resourceId, projectId]);

                const detailsRes = await client.query(`SELECT r.name as res_name, p.name as proj_name FROM resources r, projects p WHERE r.id = $1 AND p.id = $2`, [resourceId, projectId]);
                if (detailsRes.rows.length > 0) {
                    const { res_name, proj_name } = detailsRes.rows[0];
                    await notify(client, 'ASSIGNMENT_CREATED', { title: 'Nuova Assegnazione', color: 'Accent', facts: [{ name: 'Risorsa', value: res_name }, { name: 'Progetto', value: proj_name }] });
                    await client.query('INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)', 
                    [uuidv4(), resourceId, 'Nuova Assegnazione', `Sei stato assegnato al progetto ${proj_name}.`, '/staffing']);
                }
                return res.status(201).json({ id: newId, ...req.body });
            } catch (error) { return res.status(500).json({ error: (error as Error).message }); } finally { client.release(); }

        case 'DELETE':
            const delClient = await db.connect();
            try {
                const detailsRes = await delClient.query(`SELECT a.resource_id, r.name as res_name, p.name as proj_name FROM assignments a JOIN resources r ON a.resource_id = r.id JOIN projects p ON a.project_id = p.id WHERE a.id = $1`, [id]);
                await delClient.query('BEGIN');
                await delClient.query('DELETE FROM allocations WHERE assignment_id = $1', [id]);
                await delClient.query('DELETE FROM assignments WHERE id = $1', [id]);
                await delClient.query('COMMIT');

                if (detailsRes.rows.length > 0) {
                    const { resource_id, res_name, proj_name } = detailsRes.rows[0];
                    await notify(delClient, 'ASSIGNMENT_DELETED', { title: 'Assegnazione Rimossa', color: 'Warning', facts: [{ name: 'Risorsa', value: res_name }, { name: 'Progetto', value: proj_name }] });
                    await delClient.query('INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)', 
                    [uuidv4(), resource_id, 'Assegnazione Rimossa', `Sei stato rimosso dal progetto ${proj_name}.`, '/staffing']);
                }
                return res.status(204).end();
            } catch (error) { await delClient.query('ROLLBACK'); return res.status(500).json({ error: (error as Error).message }); } finally { delClient.release(); }
            
        default:
            return res.status(405).end();
    }
}
