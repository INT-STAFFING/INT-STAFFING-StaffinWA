
import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '../utils/webhookNotifier.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { id } = req.query;
    const client = await db.connect();

    try {
        if (method === 'POST') {
            const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber, notes, status } = req.body;
            const codeRes = await client.query("SELECT request_code FROM resource_requests WHERE request_code LIKE 'HCR%' ORDER BY LENGTH(request_code) DESC, request_code DESC LIMIT 1");
            let lastNum = codeRes.rows[0]?.request_code ? parseInt(codeRes.rows[0].request_code.match(/\d+/)[0]) : 0;
            const requestCode = `HCR${String(lastNum + 1).padStart(5, '0')}`;
            const newId = uuidv4();
            await client.query(`INSERT INTO resource_requests (id, version, request_code, project_id, role_id, requestor_id, start_date, end_date, commitment_percentage, is_urgent, is_long_term, is_tech_request, is_osr_open, osr_number, notes, status) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, 
            [newId, requestCode, projectId, roleId, requestorId || null, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber || null, notes, status]);
            await notify(client, 'RESOURCE_REQUEST_CREATED', { title: 'Nuova Richiesta Risorsa', color: 'Accent', facts: [{ name: 'Codice', value: requestCode }, { name: 'Urgenza', value: isUrgent ? 'SI' : 'NO' }] });
            return res.status(201).json({ id: newId, version: 1, requestCode, ...req.body });
        }

        if (method === 'PUT') {
            const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber, notes, status, version } = req.body;
            
            if (version === undefined) return res.status(400).json({ error: "Missing version for optimistic locking" });

            const oldReq = await client.query('SELECT status, request_code, requestor_id FROM resource_requests WHERE id = $1', [id]);
            if (oldReq.rows.length === 0) return res.status(404).json({ error: "Not found" });

            const result = await client.query(`UPDATE resource_requests SET project_id = $1, role_id = $2, requestor_id = $3, start_date = $4, end_date = $5, commitment_percentage = $6, is_urgent = $7, is_long_term = $8, is_tech_request = $9, is_osr_open = $10, osr_number = $11, notes = $12, status = $13, version = version + 1 
                                              WHERE id = $14 AND version = $15`, 
            [projectId, roleId, requestorId || null, startDate, endDate, commitmentPercentage, isUrgent, isLongTerm, isTechRequest, isOsrOpen, osrNumber || null, notes, status, id, version]);
            
            if (result.rowCount === 0) {
                return res.status(409).json({ error: "Conflict: Data has been modified by another user. Please refresh and try again." });
            }

            if (oldReq.rows[0]?.status !== status) {
                const code = oldReq.rows[0].request_code;
                await notify(client, 'RESOURCE_REQUEST_STATUS_CHANGED', { title: 'Stato Richiesta Variato', color: 'Accent', facts: [{ name: 'Codice', value: code }, { name: 'Nuovo Stato', value: status }] });
                if (requestorId) {
                    await client.query('INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)', 
                    [uuidv4(), requestorId, 'Aggiornamento Richiesta', `La tua richiesta ${code} è passata allo stato ${status}.`, '/resource-requests']);
                }
            }
            return res.status(200).json({ id, version: Number(version) + 1, ...req.body });
        }

        if (method === 'DELETE') { await client.query(`DELETE FROM resource_requests WHERE id = $1`, [id]); return res.status(204).end(); }
        return res.status(405).end();
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); } finally { client.release(); }
}
