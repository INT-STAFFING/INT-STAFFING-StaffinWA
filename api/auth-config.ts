/**
 * @file api/auth-config.ts
 * @description Endpoint API per gestire la configurazione dell'autenticazione.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONFIG_KEY = 'login_protection_enabled';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;

    switch (method) {
        case 'GET':
            try {
                const { rows } = await db.sql`SELECT value FROM app_config WHERE key = ${CONFIG_KEY};`;
                const isEnabled = rows[0]?.value === 'true';
                return res.status(200).json({ isEnabled });
            } catch (error) {
                console.error('Failed to get auth config:', error);
                // Return a default safe value if DB query fails
                return res.status(500).json({ isEnabled: true });
            }

        case 'POST':
            try {
                const { key, value } = req.body;
                
                if (!key || value === undefined) {
                    return res.status(400).json({ error: 'Invalid body. "key" and "value" are required.' });
                }
                
                await db.sql`
                    INSERT INTO app_config (key, value) 
                    VALUES (${key}, ${value})
                    ON CONFLICT (key) 
                    DO UPDATE SET value = ${value};
                `;

                return res.status(200).json({ success: true, key, value });

            } catch (error) {
                console.error('Failed to update app config:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}