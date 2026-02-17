/**
 * @file api/env.ts
 * @description Validazione centralizzata delle variabili d'ambiente richieste dal server.
 * Importare da qui per avere valori tipizzati come `string` senza bisogno di asserzioni `!`.
 */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not set. Server cannot start.');
}

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.NEON_POSTGRES_URL;
if (!POSTGRES_URL) {
    throw new Error('CRITICAL: Neither POSTGRES_URL nor NEON_POSTGRES_URL is set. Server cannot start.');
}

export const env = {
    JWT_SECRET,
    POSTGRES_URL,
} as const;
