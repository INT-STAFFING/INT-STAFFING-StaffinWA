
/**
 * @file api/resource-requests.ts
 * @description Endpoint API per la gestione delle operazioni CRUD sull'entità Richieste di Risorse.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '../utils/webhookNotifier.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;

    const client = await db.connect();

    switch (method) {
        case 'POST':
            try {
                const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber, notes, status } = req.body;
                
                // 1. Generate Request Code (e.g. HCR00123)
                const codeRes = await client.query(`
                    SELECT request_code 
                    FROM resource_requests 
                    WHERE request_code LIKE 'HCR%' 
                    ORDER BY LENGTH(request_code) DESC, request_code DESC 
                    LIMIT 1
                `);
                
                let lastNum = 0;
                if (codeRes.rows.length > 0 && codeRes.rows[0].request_code) {
                    const match = codeRes.rows[0].request_code.match(/HCR(\d+)/);
                    if (match) lastNum = parseInt(match[1], 10);
                }
                const nextNum = lastNum + 1;
                const requestCode = `HCR${String(nextNum).padStart(5, '0')}`;

                const newId = uuidv4();
                
                // 2. Insert
                await client.query(`
                    INSERT INTO resource_requests (
                        id, request_code, project_id, role_id, requestor_id, start_date, end_date, 
                        commitment_percentage, is_urgent, is_long_term, is_tech_request, 
                        is_osr_open, osr_number, notes, status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                `, [newId, requestCode, projectId, roleId, requestorId || null, startDate, endDate, commitmentPercentage, isUrgent || false, isLongTerm || false, isTechRequest || false, isOsrOpen || false, osrNumber || null, notes || '', status]);
                
                // --- NOTIFICATION ---
                // Fetch extended details including requestor name
                const details = await client.query(`
                    SELECT p.name as proj_name, r.name as role_name, res.name as req_name
                    FROM projects p
                    JOIN roles r ON r.id = $2
                    LEFT JOIN resources res ON res.id = $3
                    WHERE p.id = $1
                `, [projectId, roleId, requestorId || null]);
                
                if (details.rows.length > 0) {
                     const { proj_name, role_name, req_name } = details.rows[0];
                     
                     // Formatta le date per la notifica
                     const startStr = new Date(startDate).toLocaleDateString('it-IT');
                     const endStr = new Date(endDate).toLocaleDateString('it-IT');

                     await notify(client, 'RESOURCE_REQUEST_CREATED', {
                         title: 'Nuova Richiesta Risorsa',
                         color: isUrgent ? 'Attention' : 'Accent',
                         facts: [
                             { name: 'Codice', value: requestCode },
                             { name: 'Progetto', value: proj_name },
                             { name: 'Ruolo', value: role_name },
                             { name: 'Priorità', value: isUrgent ? 'URGENTE' : 'Normale' }
                         ],
                         detailedFacts: [
                            { name: 'Richiedente', value: req_name || 'N/A' },
                            { name: 'Periodo', value: `${startStr} - ${endStr}` },
                            { name: 'Impegno', value: `${commitmentPercentage}%` },
                            { name: 'Tech Request', value: isTechRequest ? 'Sì' : 'No' },
                            { name: 'OSR', value: isOsrOpen ? (osrNumber || 'Sì') : 'No' },
                            { name: 'Note', value: notes || '-' }
                         ]
                     });
                }
                // --------------------

                return res.status(201).json({ id: newId, requestCode, ...req.body });
            } catch (error) {
                console.error('Failed to create resource request:', error);
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }

        case 'PUT':
            try {
                const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber, notes, status } = req.body;
                
                // Get old status for comparison
                const oldReq = await client.query(`SELECT status, request_code FROM resource_requests WHERE id = $1`, [id]);
                const oldStatus = oldReq.rows[0]?.status;
                const requestCode = oldReq.rows[0]?.request_code;

                await client.query(`
                    UPDATE resource_requests
                    SET 
                        project_id = $1, role_id = $2, requestor_id = $3, start_date = $4, end_date = $5, 
                        commitment_percentage = $6, is_urgent = $7, is_long_term = $8, is_tech_request = $9, 
                        is_osr_open = $10, osr_number = $11, notes = $12, status = $13
                    WHERE id = $14
                `, [projectId, roleId, requestorId || null, startDate, endDate, commitmentPercentage, isUrgent || false, isLongTerm || false, isTechRequest || false, isOsrOpen || false, osrNumber || null, notes || '', status, id]);
                
                // --- NOTIFICATION ---
                if (oldStatus && oldStatus !== status) {
                     await notify(client, 'RESOURCE_REQUEST_STATUS_CHANGED', {
                         title: 'Cambio Stato Richiesta',
                         color: status === 'CHIUSA' ? 'Good' : 'Accent',
                         facts: [
                             { name: 'Codice', value: requestCode },
                             { name: 'Nuovo Stato', value: status },
                             { name: 'Stato Precedente', value: oldStatus }
                         ],
                         detailedFacts: [
                             { name: 'Note Aggiornate', value: notes || '-' }
                         ]
                     });
                }
                // --------------------

                return res.status(200).json({ id, ...req.body });
            } catch (error) {
                console.error('Failed to update resource request:', error);
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }

        case 'DELETE':
            try {
                await client.query(`DELETE FROM resource_requests WHERE id = $1`, [id]);
                return res.status(204).end();
            } catch (error) {
                console.error('Failed to delete resource request:', error);
                return res.status(500).json({ error: (error as Error).message });
            } finally {
                client.release();
            }

        default:
            res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}
