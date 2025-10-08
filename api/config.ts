import { db } from './db.ts';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

const TABLE_MAP = {
    horizontals: 'horizontals',
    seniorityLevels: 'seniority_levels',
    projectStatuses: 'project_statuses',
    clientSectors: 'client_sectors'
};

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
                // FIX: Property 'query' does not exist on `sql`. Use `db.query` for dynamic (but whitelisted) table names.
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
            try {
                const { value } = req.body;
                // FIX: Property 'query' does not exist on `sql`. Use `db.query` for dynamic (but whitelisted) table names.
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
            try {
                // FIX: Property 'query' does not exist on `sql`. Use `db.query` for dynamic (but whitelisted) table names.
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