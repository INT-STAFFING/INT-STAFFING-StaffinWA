
/**
 * @file api/assignments.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Assegnazioni.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '../utils/webhookNotifier.js';

/**
 * Gestore della richiesta API per l'endpoint /api/assignments.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query; // L'ID dell'assegnazione per l'operazione DELETE

    switch (method) {
        case 'POST':
            // Gestisce la creazione di una nuova assegnazione (risorsa <-> progetto).
            const client = await db.connect();
            try {
                const { resourceId, projectId } = req.body;

                // Controlla se un'assegnazione identica esiste già per evitare duplicati.
                const { rows } = await client.query(
                    `SELECT id FROM assignments WHERE resource_id = $1 AND project_id = $2`,
                    [resourceId, projectId]
                );

                if (rows.length > 0) {
                    return res.status(200).json({ message: 'Assignment already exists.', assignment: rows[0] });
                }

                // Se non esiste, crea una nuova assegnazione.
                const newId = uuidv4();
                await client.query(
                    `INSERT INTO assignments (id, resource_id, project_id) VALUES ($1, $2, $3)`,
                    [newId, resourceId, projectId]
                );

                // --- NOTIFICATION TRIGGER ---
                // Fetch details for the notification
                const detailsRes = await client.query(`
                    SELECT r.name as res_name, p.name as proj_name 
                    FROM resources r, projects p 
                    WHERE r.id = $1 AND p.id = $2
                `, [resourceId, projectId]);
                
                if (detailsRes.rows.length > 0) {
                    const { res_name, proj_name } = detailsRes.rows[0];
                    await notify(client, 'ASSIGNMENT_CREATED', {
                        title: 'Nuova Assegnazione Creata',
                        color: 'Accent',
                        facts: [
                            { name: 'Risorsa', value: res_name },
                            { name: 'Progetto', value: proj_name }
                        ]
                    });
                }
                // -----------------------------

                return res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }

        case 'DELETE':
            // Gestisce l'eliminazione di un'assegnazione e delle sue allocazioni associate.
            const delClient = await db.connect();
            try {
                await delClient.query('BEGIN');

                // --- NOTIFICATION TRIGGER: PRE-FETCH ---
                const detailsRes = await delClient.query(`
                    SELECT r.name as res_name, p.name as proj_name 
                    FROM assignments a
                    JOIN resources r ON a.resource_id = r.id
                    JOIN projects p ON a.project_id = p.id
                    WHERE a.id = $1
                `, [id]);
                // ---------------------------------------

                await delClient.query('DELETE FROM allocations WHERE assignment_id = $1', [id]);
                await delClient.query('DELETE FROM assignments WHERE id = $1', [id]);
                
                await delClient.query('COMMIT');

                // --- NOTIFICATION TRIGGER: SEND ---
                if (detailsRes.rows.length > 0) {
                    const { res_name, proj_name } = detailsRes.rows[0];
                    await notify(delClient, 'ASSIGNMENT_DELETED', {
                        title: 'Assegnazione Rimossa',
                        color: 'Warning',
                        facts: [
                            { name: 'Risorsa', value: res_name },
                            { name: 'Progetto', value: proj_name }
                        ]
                    });
                }
                // ----------------------------------

                return res.status(204).end(); // No Content
            } catch (error) {
                await delClient.query('ROLLBACK'); // Annulla la transazione in caso di errore.
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                delClient.release();
            }
            
        default:
            res.setHeader('Allow', ['POST', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
