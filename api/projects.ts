/**
 * @file api/projects.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Progetti.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gestore della richiesta API per l'endpoint /api/projects.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query; // L'ID del progetto per le operazioni PUT e DELETE

    switch (method) {
        case 'POST':
            // Gestisce la creazione di un nuovo progetto.
            try {
                // De-strutturazione in 'let' e sanificazione degli input per gestire
                // correttamente i valori opzionali. Stringhe vuote o valori 'falsy' vengono
                // convertiti in 'null' per coerenza con il database, risolvendo problemi di salvataggio.
                let { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes } = req.body;
                
                clientId = clientId || null;
                startDate = startDate || null;
                endDate = endDate || null;
                projectManager = projectManager || null;
                status = status || null;
                notes = notes || null;

                const newId = uuidv4();
                await db.sql`
                    INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes)
                    VALUES (${newId}, ${name}, ${clientId}, ${startDate}, ${endDate}, ${budget || 0}, ${realizationPercentage || 100}, ${projectManager}, ${status}, ${notes});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                // Gestisce la violazione del vincolo di unicità (stesso nome per lo stesso cliente).
                if ((error as any).code === '23505') {
                    return res.status(409).json({ error: `Un progetto con nome '${req.body.name}' esiste già per questo cliente.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;

        case 'PUT':
            // Gestisce la modifica di un progetto esistente.
            try {
                // Sanificazione degli input come nel caso POST.
                let { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes } = req.body;

                clientId = clientId || null;
                startDate = startDate || null;
                endDate = endDate || null;
                projectManager = projectManager || null;
                status = status || null;
                notes = notes || null;

                await db.sql`
                    UPDATE projects
                    SET name = ${name}, client_id = ${clientId}, start_date = ${startDate}, end_date = ${endDate}, budget = ${budget || 0}, realization_percentage = ${realizationPercentage || 100}, project_manager = ${projectManager}, status = ${status}, notes = ${notes}
                    WHERE id = ${id as string};
                `;
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                // Gestisce la violazione del vincolo di unicità.
                if ((error as any).code === '23505') {
                    return res.status(409).json({ error: `Un progetto con nome '${req.body.name}' esiste già per questo cliente.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;

        case 'DELETE':
            // Gestisce l'eliminazione di un progetto e di tutti i suoi dati correlati (assegnazioni, allocazioni).
            const client = await db.connect();
            try {
                // Utilizza una transazione per garantire l'integrità dei dati.
                await client.query('BEGIN');
                
                // Trova tutte le assegnazioni legate al progetto.
                const assignmentsRes = await client.query('SELECT id FROM assignments WHERE project_id = $1', [id]);
                const assignmentIds = assignmentsRes.rows.map(r => r.id);

                // Se esistono assegnazioni, elimina prima le allocazioni corrispondenti.
                if (assignmentIds.length > 0) {
                    await client.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                }
                // Elimina le assegnazioni.
                await client.query('DELETE FROM assignments WHERE project_id = $1', [id]);
                // Infine, elimina il progetto.
                await client.query('DELETE FROM projects WHERE id = $1', [id]);
                
                await client.query('COMMIT');
                res.status(204).end();
            } catch (error) {
                await client.query('ROLLBACK'); // Annulla la transazione in caso di errore.
                res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
            break;
            
        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}