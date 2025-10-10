/**
 * @file api/resources.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Risorse.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gestore della richiesta API per l'endpoint /api/resources.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query; // L'ID della risorsa per le operazioni PUT e DELETE

    switch (method) {
        case 'POST':
            // Gestisce la creazione di una nuova risorsa.
            try {
                const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes } = req.body;
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO resources (id, name, email, role_id, horizontal, location, hire_date, work_seniority, notes)
                    VALUES (${newId}, ${name}, ${email}, ${roleId}, ${horizontal}, ${location}, ${hireDate}, ${workSeniority}, ${notes});
                `;
                return res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                // Gestisce la violazione del vincolo di unicità sull'email.
                if ((error as any).code === '23505') {
                    return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` });
                }
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'PUT':
            // Gestisce la modifica di una risorsa esistente.
            try {
                const { name, email, roleId, horizontal, location, hireDate, workSeniority, notes } = req.body;
                await db.sql`
                    UPDATE resources
                    SET name = ${name}, email = ${email}, role_id = ${roleId}, horizontal = ${horizontal}, location = ${location}, hire_date = ${hireDate}, work_seniority = ${workSeniority}, notes = ${notes}
                    WHERE id = ${id as string};
                `;
                return res.status(200).json({ id, ...req.body });
            } catch (error) {
                // Gestisce la violazione del vincolo di unicità sull'email.
                if ((error as any).code === '23505') {
                    return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` });
                }
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'DELETE':
            // Gestisce l'eliminazione di una risorsa e dei suoi dati correlati (assegnazioni, allocazioni).
            const client = await db.connect();
            try {
                // Utilizza una transazione per garantire l'integrità dei dati.
                await client.query('BEGIN');
                
                // Trova tutte le assegnazioni legate alla risorsa.
                const assignmentsRes = await client.query('SELECT id FROM assignments WHERE resource_id = $1', [id]);
                const assignmentIds = assignmentsRes.rows.map(r => r.id);

                // Se esistono assegnazioni, elimina prima le allocazioni corrispondenti.
                if (assignmentIds.length > 0) {
                    await client.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                }
                // Elimina le assegnazioni.
                await client.query('DELETE FROM assignments WHERE resource_id = $1', [id]);
                // Infine, elimina la risorsa.
                await client.query('DELETE FROM resources WHERE id = $1', [id]);
                
                await client.query('COMMIT');
                return res.status(204).end();
            } catch (error) {
                await client.query('ROLLBACK'); // Annulla la transazione in caso di errore.
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
            
        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}