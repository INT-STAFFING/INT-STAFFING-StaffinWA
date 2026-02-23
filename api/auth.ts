/**
 * @file api/auth.ts
 * @description Endpoint API unificato per autenticazione e configurazione della protezione di accesso.
 *
 * Route:
 *   POST /api/auth               → login con username/password, restituisce JWT
 *   GET  /api/auth?action=config  → legge l'impostazione di protezione login
 *   POST /api/auth?action=config  → aggiorna l'impostazione di protezione login (solo ADMIN)
 */

import { db } from './_lib/db.js';
import { env } from './_lib/env.js';
import { verifyAdmin } from './_lib/auth.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { notify } from '../utils/webhookNotifier.js';

const CONFIG_KEY = 'login_protection_enabled';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { method } = req;
    const { action } = req.query;

    // ─── Sub-route: configurazione protezione login ───────────────────────────
    if (action === 'config') {
        if (method === 'GET') {
            try {
                const { rows } = await db.sql`SELECT value FROM app_config WHERE key = ${CONFIG_KEY};`;
                return res.status(200).json({ isEnabled: rows[0]?.value === 'true' });
            } catch {
                return res.status(500).json({ isEnabled: true });
            }
        }

        if (method === 'POST') {
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
                return res.status(500).json({ error: (error as Error).message });
            }
        }

        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }

    // ─── Login ────────────────────────────────────────────────────────────────
    if (method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }

    let { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password richiesti.' });
    }
    username = username.trim();
    password = password.trim();

    const client = await db.connect();
    try {
        const { rows } = await client.sql`SELECT * FROM app_users WHERE username = ${username}`;
        const user = rows[0];
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown';

        if (!user) {
            await client.sql`INSERT INTO action_logs (username, action, details, ip_address) VALUES (${username}, 'LOGIN_FAILED', '{"reason": "User not found"}', ${ip})`;
            await notify(client, 'LOGIN_FAILED', {
                title: 'Login Fallito (Utente Sconosciuto)',
                color: 'Warning',
                facts: [{ name: 'Username', value: username }, { name: 'IP', value: ip }]
            });
            return res.status(401).json({ success: false, error: 'Credenziali non valide.' });
        }

        if (!user.is_active) {
            return res.status(403).json({ success: false, error: "Utente disabilitato dall'amministratore." });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            await client.sql`INSERT INTO action_logs (user_id, username, action, details, ip_address) VALUES (${user.id}, ${username}, 'LOGIN_FAILED', '{"reason": "Invalid password"}', ${ip})`;
            await notify(client, 'LOGIN_FAILED', {
                title: 'Login Fallito (Password Errata)',
                color: 'Attention',
                facts: [{ name: 'Username', value: username }, { name: 'IP', value: ip }]
            });
            return res.status(401).json({ success: false, error: 'Credenziali non valide.' });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        const permRes = await client.sql`SELECT page_path FROM role_permissions WHERE role = ${user.role} AND is_allowed = TRUE`;
        const permissions = permRes.rows.map(r => r.page_path);
        await client.sql`INSERT INTO action_logs (user_id, username, action, details, ip_address) VALUES (${user.id}, ${username}, 'LOGIN', '{}', ${ip})`;

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                resourceId: user.resource_id,
                permissions,
                mustChangePassword: user.must_change_password,
            },
            isAdmin: user.role === 'ADMIN',
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Errore del server durante il login.' });
    } finally {
        client.release();
    }
}
