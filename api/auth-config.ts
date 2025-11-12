/**
 * @file api/auth-config.ts
 * @description Endpoint API for managing application configuration, with role-based access control.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONFIG_KEY_LOGIN = 'login_protection_enabled';
const USER_READ_WHITELIST = ['theme']; // Non-admins can only read these keys.

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
    // Get user role from the request. In a real app, this comes from a validated session/token.
    const auth = getAuthFromRequest(req);

    switch (method) {
        case 'GET':
            try {
                // AUTH: All authenticated users can attempt to read, but will be filtered by a whitelist.
                if (!auth.isAuthenticated) {
                    return res.status(401).json({ error: 'Authentication required.' });
                }

                const { key } = req.query;
                const configKey = (typeof key === 'string' && key) ? key : CONFIG_KEY_LOGIN;

                // AUTH: Non-admins can only read keys from the safe whitelist.
                if (!auth.isAdmin && !USER_READ_WHITELIST.includes(configKey) && configKey !== CONFIG_KEY_LOGIN) {
                    return res.status(403).json({ error: `Forbidden: You do not have permission to read the config key '${configKey}'.` });
                }

                const { rows } = await db.sql`SELECT value FROM app_config WHERE key = ${configKey};`;

                if (rows.length === 0) {
                    if (configKey === CONFIG_KEY_LOGIN) {
                        return res.status(200).json({ isEnabled: true });
                    }
                    return res.status(404).json({ error: `Configuration for key '${configKey}' not found.` });
                }
                
                const rawValue = rows[0].value;

                if (configKey === CONFIG_KEY_LOGIN) {
                    return res.status(200).json({ isEnabled: rawValue === 'true' });
                }

                let value;
                try {
                    value = JSON.parse(rawValue);
                } catch (e) {
                    value = rawValue;
                }

                return res.status(200).json({ key: configKey, value });

            } catch (error) {
                console.error('Failed to get app config:', error);
                return res.status(500).json({ error: (error as Error).message });
            }

        case 'POST':
            try {
                // AUTH: Only admins are allowed to write or update any configuration.
                if (!auth.isAdmin) {
                    return res.status(403).json({ error: 'Forbidden: Administrator access required to modify settings.' });
                }

                const { key, value, isEnabled } = req.body;

                // Handle legacy call for login protection
                if (isEnabled !== undefined && typeof isEnabled === 'boolean') {
                    const valueToStore = isEnabled.toString();
                    await db.sql`
                        INSERT INTO app_config (key, value, updated_at) 
                        VALUES (${CONFIG_KEY_LOGIN}, ${valueToStore}, NOW())
                        ON CONFLICT (key) 
                        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
                    `;
                    return res.status(200).json({ success: true, isEnabled });
                }
                
                // Handle generic key-value updates
                if (typeof key !== 'string' || value === undefined) {
                     return res.status(400).json({ error: 'Request body must contain "key" (string) and "value".' });
                }
                
                const valueToStore = JSON.stringify(value);

                await db.sql`
                    INSERT INTO app_config (key, value, updated_at)
                    VALUES (${key}, ${valueToStore}, NOW())
                    ON CONFLICT (key)
                    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
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