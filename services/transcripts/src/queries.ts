// Pure SQL builders — deterministic, gate-tested without a live Postgres.
// Every builder REQUIRES orgId: tenancy is structural, not optional.

export interface SqlQuery { text: string; values: unknown[] }

export function buildListQuery(orgId: string, opts: { q?: string; limit: number; offset: number }): SqlQuery {
  if (!orgId) throw new Error('orgId is required')
  const { q, limit, offset } = opts
  if (q && q.trim()) {
    return {
      text: `SELECT id, title, source, task, language, duration_sec, status, created_at, updated_at,
                    left(text, 240) AS preview,
                    ts_rank(search_tsv, websearch_to_tsquery('simple', $2)) AS rank
             FROM transcripts
             WHERE org_id = $1 AND search_tsv @@ websearch_to_tsquery('simple', $2)
             ORDER BY rank DESC, created_at DESC
             LIMIT $3 OFFSET $4`,
      values: [orgId, q.trim(), limit, offset],
    }
  }
  return {
    text: `SELECT id, title, source, task, language, duration_sec, status, created_at, updated_at,
                  left(text, 240) AS preview
           FROM transcripts
           WHERE org_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
    values: [orgId, limit, offset],
  }
}

export function buildGetQuery(orgId: string, id: string): SqlQuery {
  if (!orgId) throw new Error('orgId is required')
  return {
    text: `SELECT * FROM transcripts WHERE org_id = $1 AND id = $2`,
    values: [orgId, id],
  }
}

export function buildDeleteQuery(orgId: string, id: string): SqlQuery {
  if (!orgId) throw new Error('orgId is required')
  return {
    text: `DELETE FROM transcripts WHERE org_id = $1 AND id = $2 RETURNING id, audio_blob_id`,
    values: [orgId, id],
  }
}
