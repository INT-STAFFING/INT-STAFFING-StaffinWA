/**
 * @file api/assignments.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Assegnazioni.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

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
            try {
                const { resourceId, projectId } = req.body;

                // Controlla se un'assegnazione identica esiste già per evitare duplicati.
                const { rows } = await db.sql`
                    SELECT id FROM assignments WHERE resource_id = ${resourceId} AND project_id = ${projectId};
                `;

                if (rows.length > 0) {
                    return res.status(200).json({ message: 'Assignment already exists.', assignment: rows[0] });
                }

                // Se non esiste, crea una nuova assegnazione.
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO assignments (id, resource_id, project_id)
                    VALUES (${newId}, ${resourceId}, ${projectId});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;

        case 'DELETE':
            // Gestisce l'eliminazione di un'assegnazione e delle sue allocazioni associate.
            const client = await db.connect();
            try {
                // Utilizza una transazione per garantire che entrambe le operazioni (delete allocations, delete assignment)
                // vengano eseguite con successo o nessuna delle due.
                await client.query('BEGIN');
                await client.query('DELETE FROM allocations WHERE assignment_id = $1', [id]);
                await client.query('DELETE FROM assignments WHERE id = $1', [id]);
                await client.query('COMMIT');
                res.status(204).end(); // No Content
            } catch (error) {
                await client.query('ROLLBACK'); // Annulla la transazione in caso di errore.
                res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
            break;
            
        default:
            res.setHeader('Allow', ['POST', 'DELETE']);
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}