/**
 * @file api/allocations.ts
 * @description Endpoint API per la gestione delle operazioni di aggiornamento massivo sull'entità Allocazioni.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Placeholder for recalculation logic since it is not exported from resources.js in the current context.
// In a full implementation, this should trigger the analytics cache refresh.
const performFullRecalculation = async (client: any) => {
    // console.log("Analytics recalculation trigger (Placeholder)");
};

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
        
        for (const update of updates) {
            const { assignmentId, date, percentage } = update;
            
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

        // Trigger Recalculation (Write-Through Cache Strategy)
        await performFullRecalculation(client);

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Allocations updated successfully' });

    } catch (error) {
        await client.query('ROLLBACK'); // Annulla la transazione in caso di errore.
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}