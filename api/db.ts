import { createPool } from '@vercel/postgres';

// Questo è il punto centrale per leggere la variabile d'ambiente corretta.
const connectionString = process.env.NEON_POSTGRES_URL;

if (!connectionString) {
  // In un ambiente serverless, lanciare un errore è un buon modo per fallire rapidamente
  // se la configurazione manca. Questo sarà visibile nei log di Vercel.
  throw new Error('Database connection string is not set. Please set the NEON_POSTGRES_URL environment variable.');
}

// createPool di @vercel/postgres restituisce un'istanza di Pool estesa 
// con il template literal tag `sql`.
const pool = createPool({
  connectionString,
});

// Esportiamo il pool stesso (che ha un metodo .connect(), compatibile con db.connect())
// e la funzione sql associata.
export const db = pool;
export const sql = pool.sql;
