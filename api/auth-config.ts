/**
 * @file api/auth-config.ts
 * @description Endpoint API per gestire la configurazione dell'autenticazione.
 */

import { db } from './db.js';
import { env } from './env.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

const CONFIG_KEY = 'login_protection_enabled';

// Helper to verify JWT for admin actions
const verifyAdmin = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    
    const token = authHeader.split(' ')[1];
    if (!token) return false;

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        return decoded.role === 'ADMIN';
    } catch (e) {
        return false;
    }
};

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
            // Security check: Only admins can change this setting
            if (!verifyAdmin(req)) {
                return res.status(403).json({ error: 'Unauthorized: Only admins can change authentication settings.' });
            }

            try {
                const { isEnabled } = req.body;
                if (typeof isEnabled !== 'boolean') {
                    return res.status(400).json({ error: 'Invalid "isEnabled" value. Must be a boolean.' });
                }
                
                await db.sql`
                    INSERT INTO app_config (key, value) 
                    VALUES (${CONFIG_KEY}, ${isEnabled.toString()})
                    ON CONFLICT (key) 
                    DO UPDATE SET value = ${isEnabled.toString()};
                `;

                return res.status(200).json({ success: true, isEnabled });

            } catch (error) {
                console.error('Failed to update auth config:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}