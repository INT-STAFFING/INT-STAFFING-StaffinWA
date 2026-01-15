
import { createPool } from '@vercel/postgres';

const connectionString = process.env.POSTGRES_URL || process.env.NEON_POSTGRES_URL;

if (!connectionString) {
  console.warn('Database connection string is not set. API might fail if database access is required.');
}

export const db = createPool({
  connectionString,
});
