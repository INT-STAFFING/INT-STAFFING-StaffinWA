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

    try {
        switch (method) {
            case 'POST':
                const { projectId, roleId, requestorId, startDate, endDate, commitmentPercentage, isUrgent, status } = req.body;
                const codeRes = await client.query(`SELECT request_code FROM resource_requests WHERE request_code LIKE 'HCR%' ORDER BY LENGTH(request_code) DESC, request_code DESC LIMIT 1`);
                let lastNum = 0;
                if (codeRes.rows.length > 0) lastNum = parseInt(codeRes.rows[0].request_code.match(/\d+/)[0], 10);
                const requestCode = `HCR${String(lastNum + 1).padStart(5, '0')}`;
                const newId = uuidv4();
                await client.query(`INSERT INTO resource_requests (id, request_code, project_id, role_id, requestor_id, start_date, end_date, commitment_percentage, is_urgent, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [newId, requestCode, projectId, roleId, requestorId || null, startDate, endDate, commitmentPercentage, isUrgent || false, status]);
                
                const details = await client.query(`SELECT p.name as proj_name, r.name as role_name FROM projects p, roles r WHERE p.id = $1 AND r.id = $2`, [projectId, roleId]);
                if (details.rows.length > 0) {
                    const { proj_name, role_name } = details.rows[0];
                    await notify(client, 'RESOURCE_REQUEST_CREATED', { title: 'Nuova Richiesta', facts: [{ name: 'Codice', value: requestCode }, { name: 'Progetto', value: proj_name }, { name: 'Ruolo', value: role_name }] });
                    
                    // In-App for managers/admins
                    const admins = await client.query("SELECT resource_id FROM app_users WHERE role IN ('ADMIN', 'MANAGER') AND resource_id IS NOT NULL");
                    for (const adm of admins.rows) {
                         await client.query(`INSERT INTO notifications (id, recipient_resource_id, title, message, link, is_read) VALUES ($1, $2, $3, $4, $5, false)`, [uuidv4(), adm.resource_id, 'Nuova Richiesta Risorsa', `Nuova richiesta ${requestCode} per ${role_name} su ${proj_name}`, '/resource-requests']);
                    }
                }
                return res.status(201).json({ id: newId, requestCode, ...req.body });

            case 'PUT':
                const oldReq = await client.query(`SELECT status, request_code, requestor_id FROM resource_requests WHERE id = $1`, [id]);
                await client.query(`UPDATE resource_requests SET project_id = $1, role_id = $2, requestor_id = $3, start_date = $4, end_date = $5, commitment_percentage = $6, is_urgent = $7, status = $8 WHERE id = $9`, [req.body.projectId, req.body.roleId, req.body.requestorId || null, req.body.startDate, req.body.endDate, req.body.commitmentPercentage, req.body.isUrgent, req.body.status, id]);
                
                if (oldReq.rows[0] && oldReq.rows[0].status !== req.body.status) {
                    const { request_code, requestor_id } = oldReq.rows[0];
                    await notify(client, 'RESOURCE_REQUEST_STATUS_CHANGED', { title: 'Cambio Stato Richiesta', facts: [{ name: 'Codice', value: request_code }, { name: 'Stato', value: req.body.status }] });
                    if (requestor_id) {
                         await client.query(`INSERT INTO notifications (id, recipient_resource_id, title, message, link, is_read) VALUES ($1, $2, $3, $4, $5, false)`, [uuidv4(), requestor_id, 'Stato Richiesta Aggiornato', `La tua richiesta ${request_code} è ora ${req.body.status}`, '/resource-requests']);
                    }
                }
                return res.status(200).json({ id, ...req.body });

            case 'DELETE':
                await client.query(`DELETE FROM resource_requests WHERE id = $1`, [id]);
                return res.status(204).end();
            default:
                return res.status(405).end();
        }
    } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
    finally { client.release(); }
}
