import { db, sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;

    switch (method) {
        case 'POST':
            try {
                const { resourceId, projectId } = req.body;

                // Check if assignment already exists
                const { rows } = await sql`
                    SELECT id FROM assignments WHERE resource_id = ${resourceId} AND project_id = ${projectId};
                `;

                if (rows.length > 0) {
                    return res.status(200).json({ message: 'Assignment already exists.', assignment: rows[0] });
                }

                const newId = uuidv4();
                await sql`
                    INSERT INTO assignments (id, resource_id, project_id)
                    VALUES (${newId}, ${resourceId}, ${projectId});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'DELETE':
            const client = await db.connect();
            try {
                await client.query('BEGIN');
                await client.query('DELETE FROM allocations WHERE assignment_id = $1', [id]);
                await client.query('DELETE FROM assignments WHERE id = $1', [id]);
                await client.query('COMMIT');
                res.status(204).end();
            } catch (error) {
                await client.query('ROLLBACK');
                res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }
            break;
        default:
            res.setHeader('Allow', ['POST', 'DELETE']);
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}