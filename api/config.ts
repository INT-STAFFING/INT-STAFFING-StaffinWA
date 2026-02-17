
/**
 * @file api/config.ts
 * @description Endpoint API generico per la gestione delle operazioni CRUD sulle tabelle di configurazione.
 */

import { db } from './_lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * @const TABLE_MAP
 * @description Mappa i tipi di configurazione ricevuti dalla richiesta API ai nomi effettivi delle tabelle nel database.
 */
const TABLE_MAP = {
    functions: 'functions', // Ridenominato
    industries: 'industries', // Aggiunto
    seniorityLevels: 'seniority_levels',
    projectStatuses: 'project_statuses',
    clientSectors: 'client_sectors',
    locations: 'locations'
};

/**
 * Gestore della richiesta API per l'endpoint /api/config.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id, type } = req.query;

    if (!type || !TABLE_MAP[type as keyof typeof TABLE_MAP]) {
        return res.status(400).json({ error: 'Invalid or missing config type specified' });
    }
    const tableName = TABLE_MAP[type as keyof typeof TABLE_MAP];

    switch (method) {
        case 'POST':
            try {
                const { value } = req.body;
                const newId = uuidv4();
                await db.query(`
                    INSERT INTO ${tableName} (id, value)
                    VALUES ($1, $2);
                `, [newId, value]);
                return res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'PUT':
            try {
                const { value } = req.body;
                await db.query(`
                    UPDATE ${tableName}
                    SET value = $1
                    WHERE id = $2;
                `, [value, id]);
                return res.status(200).json({ id, ...req.body });
            } catch (error) {
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'DELETE':
            try {
                await db.query(`DELETE FROM ${tableName} WHERE id = $1;`, [id]);
                return res.status(204).end();
            } catch (error) {
                return res.status(500).json({ error: (error as Error).message });
            }
            
        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
