/**
 * @file api/calendar.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Calendario Aziendale.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * Gestore della richiesta API per l'endpoint /api/calendar.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query; 

    switch (method) {
        case 'POST':
            try {
                let { name, date, type, location } = req.body;
                if (type !== 'LOCAL_HOLIDAY') {
                    location = null;
                }
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO company_calendar (id, name, date, type, location)
                    VALUES (${newId}, ${name}, ${date}, ${type}, ${location});
                `;
                return res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                if ((error as any).code === '23505') { // unique_violation
                    return res.status(409).json({ error: `Un evento per questa data e sede esiste già.` });
                }
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'PUT':
            try {
                 let { name, date, type, location } = req.body;
                if (type !== 'LOCAL_HOLIDAY') {
                    location = null;
                }
                await db.sql`
                    UPDATE company_calendar
                    SET name = ${name}, date = ${date}, type = ${type}, location = ${location}
                    WHERE id = ${id as string};
                `;
                return res.status(200).json({ id, ...req.body });
            } catch (error) {
                if ((error as any).code === '23505') {
                     return res.status(409).json({ error: `Un evento per questa data e sede esiste già.` });
                }
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'DELETE':
            try {
                await db.sql`DELETE FROM company_calendar WHERE id = ${id as string};`;
                return res.status(204).end();
            } catch (error) {
                return res.status(500).json({ error: (error as Error).message });
            }
            
        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}