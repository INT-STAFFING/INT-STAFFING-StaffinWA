import { sql } from '@vercel/postgres';
import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method } = req;
    const { id } = req.query;
    
    switch (method) {
        case 'POST':
            try {
                const { name, seniorityLevel } = req.body;
                const newId = uuidv4();
                await sql`
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
                await sql`
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
                await sql`DELETE FROM roles WHERE id = ${id as string};`;
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
