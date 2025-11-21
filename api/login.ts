/**
 * @file api/login.ts
 * @description Endpoint API per la verifica delle credenziali di accesso tramite DB.
 */

import { db } from './db.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'staffing-app-secret-key-change-in-prod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    let { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e password richiesti.' });
    }
    
    // Sanitize input
    username = username.trim();
    password = password.trim();

    try {
        // 1. Fetch User
        const { rows } = await db.sql`SELECT * FROM app_users WHERE username = ${username}`;
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ success: false, error: "Credenziali non valide." });
        }

        // 2. Check Whitelist
        if (!user.is_active) {
            return res.status(403).json({ success: false, error: "Utente disabilitato dall'amministratore." });
        }

        // 3. Verify Password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: "Credenziali non valide." });
        }

        // 4. Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 5. Fetch Permissions
        const permRes = await db.sql`SELECT page_path FROM role_permissions WHERE role = ${user.role} AND is_allowed = TRUE`;
        const permissions = permRes.rows.map(r => r.page_path);

        // 6. Respond
        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                resourceId: user.resource_id,
                permissions
            },
            isAdmin: user.role === 'ADMIN' // Backward compatibility for frontend check
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: "Errore del server durante il login." });
    }
}