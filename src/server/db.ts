import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import { appConfig, hasDatabase } from './config.js';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!hasDatabase) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: appConfig.DATABASE_URL,
      max: 5,
      ssl: appConfig.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const activePool = getPool();
  if (!activePool) {
    throw new Error('Database connection is not configured. Set DATABASE_URL to enable persistence.');
  }

  return activePool.query<T>(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const activePool = getPool();
  if (!activePool) {
    throw new Error('Database connection is not configured. Set DATABASE_URL to enable persistence.');
  }

  const client = await activePool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

