import pg from 'pg';
import { URL } from 'url';
import { config } from '../config/index.js';

const { Pool } = pg;

const localHostPattern = /(?:localhost|127\.\d+\.\d+\.\d+|(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+)/i;

function parseConnectionUrl(url: string): pg.PoolConfig {
  const parsed = new URL(url);
  const useSsl = !localHostPattern.test(url);

  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '') || 'postgres',
    ssl: useSsl
      ? { rejectUnauthorized: false, servername: parsed.hostname }
      : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

export const pool = new Pool(parseConnectionUrl(config.databaseUrl));

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}