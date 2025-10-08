import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;
    
    switch (method) {
        case 'POST':
            try {
                const { name, sector, contactEmail } = req.body;
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO clients (id, name, sector, contact_email)
                    VALUES (${newId}, ${name}, ${sector}, ${contactEmail});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                // COMMENTO: Aggiunta gestione per nomi duplicati.
                if ((error as any).code === '23505') { // unique_violation
                    return res.status(409).json({ error: `Un cliente con nome '${req.body.name}' esiste già.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'PUT':
            try {
                const { name, sector, contactEmail } = req.body;
                await db.sql`
                    UPDATE clients
                    SET name = ${name}, sector = ${sector}, contact_email = ${contactEmail}
                    WHERE id = ${id as string};
                `;
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                // COMMENTO: Aggiunta gestione per nomi duplicati.
                if ((error as any).code === '23505') { // unique_violation
                    return res.status(409).json({ error: `Un cliente con nome '${req.body.name}' esiste già.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'DELETE':
            try {
                // COMMENTO: Aggiunto controllo per impedire l'eliminazione di un cliente se ha progetti associati.
                const { rows } = await db.sql`SELECT COUNT(*) FROM projects WHERE client_id = ${id as string};`;
                if (rows[0].count > 0) {
                    return res.status(409).json({ error: `Impossibile eliminare il cliente. È ancora associato a ${rows[0].count} progetto/i.` });
                }
                await db.sql`DELETE FROM clients WHERE id = ${id as string};`;
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
