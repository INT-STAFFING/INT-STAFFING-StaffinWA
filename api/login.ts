
/**
 * @file api/login.ts
 * @description Endpoint API per la verifica delle credenziali di accesso tramite DB.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    if (!JWT_SECRET) {
        console.error('CRITICAL ERROR: JWT_SECRET environment variable is not set.');
        return res.status(500).json({ error: "Errore di configurazione del server (JWT_SECRET mancante)." });
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

        if (!user) {
            const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
            await client.sql`INSERT INTO action_logs (username, action, details, ip_address) VALUES (${username}, 'LOGIN_FAILED', '{"reason": "User not found"}', ${ip})`;
            return res.status(401).json({ success: false, error: "Credenziali non valide." });
        }

        if (!user.is_active) {
            return res.status(403).json({ success: false, error: "Utente disabilitato dall'amministratore." });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
            await client.sql`INSERT INTO action_logs (user_id, username, action, details, ip_address) VALUES (${user.id}, ${username}, 'LOGIN_FAILED', '{"reason": "Invalid password"}', ${ip})`;
            return res.status(401).json({ success: false, error: "Credenziali non valide." });
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        const permRes = await client.sql`SELECT page_path FROM role_permissions WHERE role = ${user.role} AND is_allowed = TRUE`;
        const permissions = permRes.rows.map(r => r.page_path);

        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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
                mustChangePassword: user.must_change_password
            },
            isAdmin: user.role === 'ADMIN'
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: "Errore del server durante il login." });
    } finally {
        client.release();
    }
}
