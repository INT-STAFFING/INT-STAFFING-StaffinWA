import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;
    
    switch (method) {
        case 'POST':
            try {
                const { name, seniorityLevel } = req.body;
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO roles (id, name, seniority_level)
                    VALUES (${newId}, ${name}, ${seniorityLevel});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'PUT':
            try {
                const { name, seniorityLevel } = req.body;
                await db.sql`
                    UPDATE roles
                    SET name = ${name}, seniority_level = ${seniorityLevel}
                    WHERE id = ${id as string};
                `;
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'DELETE':
            try {
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