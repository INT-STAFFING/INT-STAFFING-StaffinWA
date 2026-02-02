
/**
 * @file api/assignments.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Assegnazioni.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify, generateTeamsMentions } from '../services/notificationService';

/**
 * Gestore della richiesta API per l'endpoint /api/assignments.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query; // L'ID dell'assegnazione per l'operazione DELETE

    const client = await db.connect();

    try {
        switch (method) {
            case 'POST':
                // Gestisce la creazione di una nuova assegnazione (risorsa <-> progetto).
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

                    // --- TRIGGER NOTIFICATION: RESOURCE_ASSIGNED ---
                    // 1. Fetch details
                    const resRows = await client.query('SELECT name, email FROM resources WHERE id = $1', [resourceId]);
                    const projRows = await client.query('SELECT name, client_id FROM projects WHERE id = $1', [projectId]);
                    
                    if (resRows.rows.length > 0 && projRows.rows.length > 0) {
                        const resource = resRows.rows[0];
                        const project = projRows.rows[0];
                        
                        let clientName = 'N/D';
                        if (project.client_id) {
                            const cliRows = await client.query('SELECT name FROM clients WHERE id = $1', [project.client_id]);
                            clientName = cliRows.rows[0]?.name || 'N/D';
                        }
                        
                        const mentionsData = generateTeamsMentions([resource]); // Mention the assigned resource

                        await notify(client, 'RESOURCE_ASSIGNED', {
                            resourceName: resource.name,
                            projectName: project.name,
                            clientName: clientName,
                            ...mentionsData
                        });
                    }

                    return res.status(201).json({ id: newId, ...req.body });
                } catch (error) {
                    return res.status(500).json({ error: (error as Error).message });
                }

            case 'DELETE':
                // Gestisce l'eliminazione di un'assegnazione e delle sue allocazioni associate.
                try {
                    // Utilizza una transazione per garantire che entrambe le operazioni (delete allocations, delete assignment)
                    // vengano eseguite con successo o nessuna delle due.
                    await client.query('BEGIN');
                    await client.query('DELETE FROM allocations WHERE assignment_id = $1', [id]);
                    await client.query('DELETE FROM assignments WHERE id = $1', [id]);
                    await client.query('COMMIT');
                    return res.status(204).end(); // No Content
                } catch (error) {
                    await client.query('ROLLBACK'); // Annulla la transazione in caso di errore.
                    return res.status(500).json({ error: (error as Error).message });
                }
                
            default:
                res.setHeader('Allow', ['POST', 'DELETE']);
                return res.status(405).end(`Method ${method} Not Allowed`);
        }
    } finally {
        client.release();
    }
}
