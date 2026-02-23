/**
 * @file api/_lib/auth.ts
 * @description Utility condivise per autenticazione e autorizzazione server-side.
 * Centralizza la verifica JWT evitando duplicazioni tra gli endpoint.
 */

import { env } from './env.js';
import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

export const OPERATIONAL_ROLES = ['ADMIN', 'MANAGER', 'SENIOR MANAGER', 'MANAGING DIRECTOR'] as const;

/**
 * Verifica che la richiesta provenga da un utente con ruolo ADMIN.
 */
export const verifyAdmin = (req: VercelRequest): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        return decoded.role === 'ADMIN';
    } catch (e) { return false; }
};

/**
 * Estrae l'utente corrente dal token JWT della richiesta.
 * Restituisce null se il token è assente o non valido.
 */
export const getUserFromRequest = (req: VercelRequest): { id: string; username: string; role: string } | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        return { id: decoded.userId, username: decoded.username, role: decoded.role };
    } catch (e) { return null; }
};
