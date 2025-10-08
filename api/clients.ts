import { sql } from '@vercel/postgres';
import { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { method } = req;
    const { id } = req.query;
    
    switch (method) {
        case 'POST':
            try {
                const { name, sector, contactEmail } = req.body;
                const newId = uuidv4();
                await sql`
                    INSERT INTO clients (id, name, sector, contact_email)
                    VALUES (${newId}, ${name}, ${sector}, ${contactEmail});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'PUT':
            try {
                const { name, sector, contactEmail } = req.body;
                await sql`
                    UPDATE clients
                    SET name = ${name}, sector = ${sector}, contact_email = ${contactEmail}
                    WHERE id = ${id as string};
                `;
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'DELETE':
            try {
                // Note: In a real app, you might want to handle cascading deletes for projects, etc.
                await sql`DELETE FROM clients WHERE id = ${id as string};`;
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
