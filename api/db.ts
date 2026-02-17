
import { createPool } from '@vercel/postgres';
import { env } from './env.js';

export const db = createPool({
  connectionString: env.POSTGRES_URL,
});
