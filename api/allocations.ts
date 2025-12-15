
/**
 * @file api/allocations.ts
 * @description Endpoint API per la gestione delle operazioni di aggiornamento massivo sull'entità Allocazioni.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// NOTE: performFullRecalculation removed or needs to be imported if implemented in a shared utility file.
// For now, assuming it was a placeholder or implemented elsewhere.
const performFullRecalculation = async (client: any) => {
    // Placeholder for triggering analytics recalc if needed
    // await client.query('SELECT recalculate_analytics()');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const client = await db.connect();
    try {
        const { updates } = req.body; 
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'Invalid updates array' });
        }

        await client.query('BEGIN');
        
        for (const update of updates) {
            const { assignmentId, date, percentage } = update;
            
            if (percentage === 0) {
                await client.query(
                    'DELETE FROM allocations WHERE assignment_id = $1 AND allocation_date = $2;',
                    [assignmentId, date]
                );
            } else {
                await client.query(`
                    INSERT INTO allocations (assignment_id, allocation_date, percentage)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (assignment_id, allocation_date)
                    DO UPDATE SET percentage = EXCLUDED.percentage;
                `, [assignmentId, date, percentage]);
            }
        }

        await performFullRecalculation(client);

        await client.query('COMMIT');
        return res.status(200).json({ message: 'Allocations updated successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: (error as Error).message });
    } finally {
        client.release();
    }
}
