/**
 * @file api/roles.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Ruoli.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gestore della richiesta API per l'endpoint /api/roles.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query; // L'ID del ruolo per le operazioni PUT e DELETE
    
    switch (method) {
        case 'POST':
            // Gestisce la creazione di un nuovo ruolo.
            try {
                const { name, seniorityLevel, dailyCost } = req.body;
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO roles (id, name, seniority_level, daily_cost)
                    VALUES (${newId}, ${name}, ${seniorityLevel}, ${dailyCost});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                // Gestisce la violazione del vincolo di unicità sul nome del ruolo.
                if ((error as any).code === '23505') { // unique_violation
                    return res.status(409).json({ error: `Un ruolo con nome '${req.body.name}' esiste già.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;

        case 'PUT':
            // Gestisce la modifica di un ruolo esistente.
            try {
                const { name, seniorityLevel, dailyCost } = req.body;
                await db.sql`
                    UPDATE roles
                    SET name = ${name}, seniority_level = ${seniorityLevel}, daily_cost = ${dailyCost}
                    WHERE id = ${id as string};
                `;
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                // Gestisce la violazione del vincolo di unicità sul nome del ruolo.
                if ((error as any).code === '23505') { // unique_violation
                    return res.status(409).json({ error: `Un ruolo con nome '${req.body.name}' esiste già.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;

        case 'DELETE':
            // Gestisce l'eliminazione di un ruolo.
            try {
                // Impedisce l'eliminazione se il ruolo è ancora assegnato a delle risorse.
                const { rows } = await db.sql`SELECT COUNT(*) FROM resources WHERE role_id = ${id as string};`;
                if (rows[0].count > 0) {
                    return res.status(409).json({ error: `Impossibile eliminare il ruolo. È ancora assegnato a ${rows[0].count} risorsa/e.` });
                }
                await db.sql`DELETE FROM roles WHERE id = ${id as string};`;
                res.status(204).end();
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
            
        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}