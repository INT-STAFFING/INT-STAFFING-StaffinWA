import { createPool } from '@vercel/postgres';

/**
 * Creates and exports the database connection pool.
 * When deployed on Vercel with a Vercel Postgres database linked,
 * `@vercel/postgres` automatically uses the correct connection string
 * from the environment. This "zero-config" approach is the most robust method.
 *
 * For local development, it will read the `POSTGRES_URL` from the
 * `.env.development.local` file.
 */
export const db = createPool();

// By not specifying a connection string, we let the library handle
// the connection automatically, which is the recommended practice for Vercel deployments.
