/**
 * @file api/allocations.ts
 * @description Endpoint API per la gestione delle operazioni di aggiornamento massivo sull'entità Allocazioni.
 */

import { db } from './_lib/db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';
import { notify } from '../utils/webhookNotifier.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).end();
    const client = await db.connect();
    try {
        const { updates } = req.body;
        if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'Invalid' });

        await client.query('BEGIN');
        const modifiedAssignments = new Set<string>();
        for (const update of updates) {
            const { assignmentId, date, percentage } = update;
            modifiedAssignments.add(assignmentId);
            if (percentage === 0) await client.query('DELETE FROM allocations WHERE assignment_id = $1 AND allocation_date = $2', [assignmentId, date]);
            else await client.query('INSERT INTO allocations (assignment_id, allocation_date, percentage) VALUES ($1, $2, $3) ON CONFLICT (assignment_id, allocation_date) DO UPDATE SET percentage = EXCLUDED.percentage', [assignmentId, date, percentage]);
        }
        await client.query('COMMIT');
        
        for (const assignmentId of modifiedAssignments) {
            const detailsRes = await client.query(`SELECT a.resource_id, r.name as res_name, p.name as proj_name FROM assignments a JOIN resources r ON a.resource_id = r.id JOIN projects p ON a.project_id = p.id WHERE a.id = $1`, [assignmentId]);
            if (detailsRes.rows.length > 0) {
                const { resource_id, res_name, proj_name } = detailsRes.rows[0];
                const count = updates.filter((u: any) => u.assignmentId === assignmentId).length;
                await notify(client, 'ALLOCATION_CHANGED', { title: 'Allocazione Modificata', color: 'Good', facts: [{ name: 'Risorsa', value: res_name }, { name: 'Progetto', value: proj_name }, { name: 'Giorni', value: count.toString() }] });
                if (count > 1) { // Notifica interna solo per modifiche massive per evitare spam
                    await client.query('INSERT INTO notifications (id, recipient_resource_id, title, message, link) VALUES ($1, $2, $3, $4, $5)', 
                    [uuidv4(), resource_id, 'Modifica Allocazioni', `Le tue allocazioni sul progetto ${proj_name} sono state aggiornate per ${count} giorni.`, '/workload']);
                }
            }
        }
        return res.status(200).json({ success: true });
    } catch (error) { await client.query('ROLLBACK'); return res.status(500).json({ error: (error as Error).message }); } finally { client.release(); }
}
