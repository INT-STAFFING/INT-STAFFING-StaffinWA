import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;

    switch (method) {
        case 'POST':
            try {
                const { name, email, roleId, horizontal, hireDate, workSeniority, notes } = req.body;
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO resources (id, name, email, role_id, horizontal, hire_date, work_seniority, notes)
                    VALUES (${newId}, ${name}, ${email}, ${roleId}, ${horizontal}, ${hireDate}, ${workSeniority}, ${notes});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                // COMMENTO: Aggiunta gestione per email duplicate.
                if ((error as any).code === '23505') { // unique_violation on email
                    return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'PUT':
            try {
                const { name, email, roleId, horizontal, hireDate, workSeniority, notes } = req.body;
                await db.sql`
                    UPDATE resources
                    SET name = ${name}, email = ${email}, role_id = ${roleId}, horizontal = ${horizontal}, hire_date = ${hireDate}, work_seniority = ${workSeniority}, notes = ${notes}
                    WHERE id = ${id as string};
                `;
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                // COMMENTO: Aggiunta gestione per email duplicate.
                if ((error as any).code === '23505') { // unique_violation on email
                    return res.status(409).json({ error: `Una risorsa con email '${req.body.email}' esiste già.` });
                }
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'DELETE':
            const client = await db.connect();
            try {
                await client.query('BEGIN');
                const assignmentsRes = await client.query('SELECT id FROM assignments WHERE resource_id = $1', [id]);
                const assignmentIds = assignmentsRes.rows.map(r => r.id);

                if (assignmentIds.length > 0) {
                    await client.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                }
                await client.query('DELETE FROM assignments WHERE resource_id = $1', [id]);
                await client.query('DELETE FROM resources WHERE id = $1', [id]);
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
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}
