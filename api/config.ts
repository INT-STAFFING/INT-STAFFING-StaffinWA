/**
 * @file api/config.ts
 * @description Endpoint API generico per la gestione delle operazioni CRUD sulle tabelle di configurazione.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

/**
 * @const TABLE_MAP
 * @description Mappa i tipi di configurazione ricevuti dalla richiesta API ai nomi effettivi delle tabelle nel database.
 * Questo agisce come una whitelist per prevenire accessi non autorizzati ad altre tabelle.
 */
const TABLE_MAP = {
    horizontals: 'horizontals',
    seniorityLevels: 'seniority_levels',
    projectStatuses: 'project_statuses',
    clientSectors: 'client_sectors'
};

/**
 * Gestore della richiesta API per l'endpoint /api/config.
 * Esegue operazioni CRUD su una tabella di configurazione specificata dal parametro `type` nella query.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id, type } = req.query;

    // Validazione del parametro 'type'.
    if (!type || !TABLE_MAP[type as keyof typeof TABLE_MAP]) {
        return res.status(400).json({ error: 'Invalid or missing config type specified' });
    }
    const tableName = TABLE_MAP[type as keyof typeof TABLE_MAP];

    switch (method) {
        case 'POST':
            // Gestisce la creazione di una nuova opzione di configurazione.
            try {
                const { value } = req.body;
                const newId = uuidv4();
                // Usa db.query per costruire la query con un nome di tabella dinamico (ma validato).
                await db.query(`
                    INSERT INTO ${tableName} (id, value)
                    VALUES ($1, $2);
                `, [newId, value]);
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;

        case 'PUT':
            // Gestisce la modifica di un'opzione di configurazione esistente.
            try {
                const { value } = req.body;
                await db.query(`
                    UPDATE ${tableName}
                    SET value = $1
                    WHERE id = $2;
                `, [value, id]);
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;

        case 'DELETE':
            // Gestisce l'eliminazione di un'opzione di configurazione.
            try {
                await db.query(`DELETE FROM ${tableName} WHERE id = $1;`, [id]);
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