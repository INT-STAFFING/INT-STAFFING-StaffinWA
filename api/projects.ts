import { db, sql } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;

    switch (method) {
        case 'POST':
            try {
                const { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes } = req.body;
                const newId = uuidv4();
                await sql`
                    INSERT INTO projects (id, name, client_id, start_date, end_date, budget, realization_percentage, project_manager, status, notes)
                    VALUES (${newId}, ${name}, ${clientId}, ${startDate}, ${endDate}, ${budget}, ${realizationPercentage}, ${projectManager}, ${status}, ${notes});
                `;
                res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'PUT':
            try {
                const { name, clientId, startDate, endDate, budget, realizationPercentage, projectManager, status, notes } = req.body;
                await sql`
                    UPDATE projects
                    SET name = ${name}, client_id = ${clientId}, start_date = ${startDate}, end_date = ${endDate}, budget = ${budget}, realization_percentage = ${realizationPercentage}, project_manager = ${projectManager}, status = ${status}, notes = ${notes}
                    WHERE id = ${id as string};
                `;
                res.status(200).json({ id, ...req.body });
            } catch (error) {
                res.status(500).json({ error: (error as Error).message });
            }
            break;
        case 'DELETE':
             const client = await db.connect();
            try {
                await client.query('BEGIN');
                const assignmentsRes = await client.query('SELECT id FROM assignments WHERE project_id = $1', [id]);
                const assignmentIds = assignmentsRes.rows.map(r => r.id);

                if (assignmentIds.length > 0) {
                    await client.query('DELETE FROM allocations WHERE assignment_id = ANY($1::uuid[])', [assignmentIds]);
                }
                await client.query('DELETE FROM assignments WHERE project_id = $1', [id]);
                await client.query('DELETE FROM projects WHERE id = $1', [id]);
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