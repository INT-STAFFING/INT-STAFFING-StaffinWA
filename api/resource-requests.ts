
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
                const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber, notes, status } = req.body;
                
                // 1. Generate Request Code (e.g. HCR00123)
                // Use substring to sort numerically to find the true max
                const codeRes = await db.sql`
                    SELECT request_code 
                    FROM resource_requests 
                    WHERE request_code IS NOT NULL 
                    ORDER BY CAST(SUBSTRING(request_code FROM 4) AS INTEGER) DESC 
                    LIMIT 1
                `;
                
                let lastNum = 0;
                if (codeRes.rows.length > 0 && codeRes.rows[0].request_code) {
                    const match = codeRes.rows[0].request_code.match(/HCR(\d+)/);
                    if (match) lastNum = parseInt(match[1], 10);
                }
                const nextNum = lastNum + 1;
                const requestCode = `HCR${String(nextNum).padStart(5, '0')}`;

                const newId = uuidv4();
                
                // 2. Insert
                // Ensure optional fields are explicitly null if undefined or empty
                await db.sql`
                    INSERT INTO resource_requests (
                        id, request_code, project_id, role_id, requestor_id, start_date, end_date, 
                        commitment_percentage, is_urgent, is_long_term, is_tech_request, 
                        is_osr_open, osr_number, notes, status
                    )
                    VALUES (
                        ${newId}, ${requestCode}, ${projectId}, ${roleId}, ${requestorId || null}, ${startDate}, ${endDate}, 
                        ${commitmentPercentage}, ${isUrgent || false}, ${isLongTerm || false}, ${isTechRequest || false}, 
                        ${isOsrOpen || false}, ${osrNumber || null}, ${notes || ''}, ${status}
                    );
                `;
                
                return res.status(201).json({ id: newId, requestCode, ...req.body });
            } catch (error) {
                console.error('Failed to create resource request:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'PUT':
            try {
                const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber, notes, status } = req.body;
                
                await db.sql`
                    UPDATE resource_requests
                    SET 
                        project_id = ${projectId}, 
                        role_id = ${roleId}, 
                        requestor_id = ${requestorId || null}, 
                        start_date = ${startDate}, 
                        end_date = ${endDate}, 
                        commitment_percentage = ${commitmentPercentage},
                        is_urgent = ${isUrgent || false}, 
                        is_long_term = ${isLongTerm || false}, 
                        is_tech_request = ${isTechRequest || false}, 
                        is_osr_open = ${isOsrOpen || false}, 
                        osr_number = ${osrNumber || null}, 
                        notes = ${notes || ''}, 
                        status = ${status}
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