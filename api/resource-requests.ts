/**
 * @file api/resource-requests.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Richieste di Risorse.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;

    switch (method) {
        case 'POST':
            try {
                const { projectId, roleId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, notes, status } = req.body;
                const newId = uuidv4();
                await db.sql`
                    INSERT INTO resource_requests (id, project_id, role_id, start_date, end_date, commitment_percentage, is_urgent, is_long_term, is_tech_request, notes, status)
                    VALUES (${newId}, ${projectId}, ${roleId}, ${startDate}, ${endDate}, ${commitmentPercentage}, ${isUrgent}, ${isLongTerm}, ${isTechRequest}, ${notes}, ${status});
                `;
                return res.status(201).json({ id: newId, ...req.body });
            } catch (error) {
                console.error('Failed to create resource request:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'PUT':
            try {
                const { projectId, roleId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, notes, status } = req.body;
                await db.sql`
                    UPDATE resource_requests
                    SET project_id = ${projectId}, role_id = ${roleId}, start_date = ${startDate}, end_date = ${endDate}, commitment_percentage = ${commitmentPercentage},
                        is_urgent = ${isUrgent}, is_long_term = ${isLongTerm}, is_tech_request = ${isTechRequest}, notes = ${notes}, status = ${status}
                    WHERE id = ${id as string};
                `;
                return res.status(200).json({ id, ...req.body });
            } catch (error) {
                console.error('Failed to update resource request:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'DELETE':
            try {
                await db.sql`DELETE FROM resource_requests WHERE id = ${id as string};`;
                return res.status(204).end();
            } catch (error) {
                console.error('Failed to delete resource request:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
