import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

// Detect local/private PostgreSQL hosts so we don't force SSL on them.
const localHostPattern = /(?:localhost|127\.\d+\.\d+\.\d+|(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+)/i;
const useSsl = !localHostPattern.test(config.databaseUrl);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

/**
 * Execute a parameterised query and return rows.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Execute a query that should return exactly one row.
 * Returns null if no row found.
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
