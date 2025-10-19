/**
 * @file api/login.ts
 * @description Endpoint API per la verifica delle credenziali di accesso.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { password } = req.body;

    // Recupera le password dalle variabili d'ambiente
    const appPassword = process.env.APP_PASSWORD;
    const adminPassword = process.env.APP_ADMIN_PASSWORD;
    
    if (!appPassword || !adminPassword) {
        console.error("Environment variables APP_PASSWORD or APP_ADMIN_PASSWORD are not set.");
        return res.status(500).json({ error: "Server configuration error." });
    }

    if (password === adminPassword) {
        // Admin login successful
        return res.status(200).json({ success: true, isAdmin: true });
    }

    if (password === appPassword) {
        // User login successful
        return res.status(200).json({ success: true, isAdmin: false });
    }

    // Login failed
    return res.status(401).json({ success: false, error: "Password non corretta." });
}
