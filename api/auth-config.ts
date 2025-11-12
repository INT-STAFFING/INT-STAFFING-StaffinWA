/**
 * @file api/auth-config.ts
 * @description Endpoint API for managing application configuration, with role-based access control.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONFIG_KEY_LOGIN = 'login_protection_enabled';
const USER_READ_WHITELIST = ['theme', 'dashboardLayout']; // Non-admins can only read these keys.

/**
 * Placeholder function for getting user authentication details from a request.
 * In a real app, this would involve validating a JWT, session cookie, or other auth mechanism.
 * @param {VercelRequest} req The incoming request.
 * @returns {{ isAuthenticated: boolean; isAdmin: boolean }} The user's auth status.
 */
function getAuthFromRequest(req: VercelRequest): { isAuthenticated: boolean; isAdmin: boolean } {
    // FOR DEMONSTRATION PURPOSES:
    // This simulates checking an Authorization header. Replace this with your actual auth system.
    // You can test this by sending 'Authorization: Bearer admin-secret-token' or 'user-secret-token'.
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer admin-secret-token') { // Simulate admin user
        return { isAuthenticated: true, isAdmin: true };
    }
    if (authHeader === 'Bearer user-secret-token') { // Simulate regular user
        return { isAuthenticated: true, isAdmin: false };
    }
    // For now, default to admin for internal app calls, assuming no public unauthenticated access is needed for config.
    // In a real app with proper tokens, you would default to "false, false".
    return { isAuthenticated: true, isAdmin: true };
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    
    // --- Authentication & Authorization ---
    const auth = getAuthFromRequest(req);

    switch (method) {
        case 'GET':
            try {
                if (!auth.isAuthenticated) {
                    return res.status(401).json({ error: 'Authentication required.' });
                }

                const { key } = req.query;

                // SPECIAL CASE: Handle legacy call from useAuth which has no `key` query param
                if (!key) {
                    const { rows } = await db.sql`SELECT value FROM app_config WHERE key = ${CONFIG_KEY_LOGIN};`;
                    const isEnabled = rows.length > 0 ? rows[0].value === 'true' : true; // Default to true if not set
                    return res.status(200).json({ isEnabled });
                }
                
                // GENERIC CASE: Handle calls from useAppConfig which always have a `key`
                const configKey = key as string;

                if (!auth.isAdmin && !USER_READ_WHITELIST.includes(configKey) && configKey !== CONFIG_KEY_LOGIN) {
                    return res.status(403).json({ error: `Forbidden: You do not have permission to read the config key '${configKey}'.` });
                }

                const { rows } = await db.sql`SELECT value FROM app_config WHERE key = ${configKey};`;

                let value: any;
                if (rows.length === 0) {
                    if (configKey === CONFIG_KEY_LOGIN) {
                        value = true; // Default to enabled if not in DB
                    } else {
                        return res.status(404).json({ error: `Configuration for key '${configKey}' not found.` });
                    }
                } else {
                    const rawValue = rows[0].value;
                    if (configKey === CONFIG_KEY_LOGIN) {
                        value = rawValue === 'true';
                    } else {
                        try { value = JSON.parse(rawValue); } 
                        catch (e) { value = rawValue; }
                    }
                }
                // ALWAYS return this consistent format for generic calls
                return res.status(200).json({ key: configKey, value });

            } catch (error) {
                console.error('Failed to get app config:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'POST':
            try {
                if (!auth.isAdmin) {
                    return res.status(403).json({ error: 'Forbidden: Administrator access required to modify settings.' });
                }

                const { key, value, isEnabled } = req.body;
                
                let keyToUpdate: string;
                let valueToUpdate: any;
                let isLegacyCall = false;
                
                // Determine if it's a legacy or generic call
                if (isEnabled !== undefined) {
                    isLegacyCall = true;
                    keyToUpdate = CONFIG_KEY_LOGIN;
                    valueToUpdate = !!isEnabled;
                } else {
                    keyToUpdate = key;
                    valueToUpdate = value;
                }

                if (typeof keyToUpdate !== 'string' || valueToUpdate === undefined) {
                     return res.status(400).json({ error: 'Request body must contain required fields.' });
                }
                
                // Unify storage format
                let valueToStore: string;
                if (keyToUpdate === CONFIG_KEY_LOGIN) {
                    valueToStore = String(!!valueToUpdate); // Always store as 'true' or 'false' string
                } else {
                    valueToStore = JSON.stringify(valueToUpdate);
                }

                await db.sql`
                    INSERT INTO app_config (key, value, updated_at)
                    VALUES (${keyToUpdate}, ${valueToStore}, NOW())
                    ON CONFLICT (key)
                    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
                `;
                
                // Return the correct response shape based on the call type
                if (isLegacyCall) {
                    return res.status(200).json({ success: true, isEnabled: valueToUpdate });
                } else {
                    return res.status(200).json({ success: true, key: keyToUpdate, value: valueToUpdate });
                }

            } catch (error) {
                console.error('Failed to update app config:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${method} Not Allowed`);
    }
}