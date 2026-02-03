
/**
 * @file api/allocations.ts
 * @description Endpoint API per la gestione delle operazioni di aggiornamento massivo sull'entità Allocazioni.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { notify } from '../utils/webhookNotifier.js';

/**
 * Gestore della richiesta API per l'endpoint /api/allocations.
 * Risponde solo a richieste POST per aggiornare o creare allocazioni.
 * @param {VercelRequest} req - L'oggetto della richiesta Vercel. Il body deve contenere un array `updates`.
 * @param {VercelResponse} res - L'oggetto della risposta Vercel.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const client = await db.connect();
    try {
        const { updates } = req.body; // updates: [{ assignmentId, date, percentage }]
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Invalid updates array' });
        }

        // Avvia una transazione per garantire che tutti gli aggiornamenti vengano eseguiti atomicamente.
        await client.query('BEGIN');
        
        const modifiedAssignments = new Set<string>();

        for (const update of updates) {
            const { assignmentId, date, percentage } = update;
            modifiedAssignments.add(assignmentId);
            
            // Se la percentuale è 0, l'allocazione viene eliminata.
            if (percentage === 0) {
                await client.query(
                    'DELETE FROM allocations WHERE assignment_id = $1 AND allocation_date = $2;',
                    [assignmentId, date]
                );
            } else {
                // Altrimenti, inserisce una nuova allocazione o aggiorna quella esistente se la combinazione
                // di assignment_id e allocation_date esiste già (UPSERT).
                await client.query(`
                    INSERT INTO allocations (assignment_id, allocation_date, percentage)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (assignment_id, allocation_date)
                    DO UPDATE SET percentage = EXCLUDED.percentage;
                `, [assignmentId, date, percentage]);
            }
        }

        // COMMIT immediato per rendere persistenti i dati
        await client.query('COMMIT');
        
        // --- NOTIFICATION TRIGGER ---
        // Group by assignment to minimize notifications
        for (const assignmentId of modifiedAssignments) {
            const detailsRes = await client.query(`
                SELECT r.name as res_name, p.name as proj_name 
                FROM assignments a
                JOIN resources r ON a.resource_id = r.id
                JOIN projects p ON a.project_id = p.id
                WHERE a.id = $1
            `, [assignmentId]);
            
            if (detailsRes.rows.length > 0) {
                const { res_name, proj_name } = detailsRes.rows[0];
                const count = updates.filter((u: any) => u.assignmentId === assignmentId).length;
                await notify(client, 'ALLOCATION_CHANGED', {
                    title: 'Allocazione Modificata',
                    color: 'Good',
                    facts: [
                        { name: 'Risorsa', value: res_name },
                        { name: 'Progetto', value: proj_name },
                        { name: 'Giorni Modificati', value: count.toString() }
                    ]
                });
            }
        }
        // -----------------------------

        // ASYNC TRIGGER: "Fire and Forget"
        // Lancia il ricalcolo delle analitiche senza attendere la risposta (non-blocking).
        // In ambiente Vercel Serverless questo pattern è "best-effort" ma sufficiente per cache invalidation.
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        
        if (host) {
            const recalcUrl = `${protocol}://${host}/api/resources?entity=analytics_cache&action=recalc_all`;
            // Non usiamo 'await' qui intenzionalmente per non bloccare la risposta UI
            fetch(recalcUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    // Passiamo l'header di auth per mantenere il contesto di sicurezza
                    'Authorization': req.headers.authorization || '' 
                }
            }).catch(err => console.error("[Allocations] Async recalc trigger failed:", err));
        }

        // Risposta immediata all'utente
        return res.status(200).json({ message: 'Allocations updated successfully' });

    } catch (error) {
        await client.query('ROLLBACK'); // Annulla la transazione in caso di errore.
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
