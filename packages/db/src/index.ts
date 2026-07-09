// @semaje/db — shared Postgres pool factory. Infrastructure glue only;
// business queries live inside each service.
import pg from 'pg'

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL
        || 'postgres://semaje:semaje@localhost:5432/semaje',
      max: Number(process.env.PG_POOL_MAX || 10),
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) { await pool.end(); pool = null }
}

/** Test seam: inject a fake pool (gate tests never hit a real PG). */
export function _setPool(p: unknown): void { pool = p as pg.Pool }
