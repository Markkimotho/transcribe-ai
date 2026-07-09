// ═══════════════════════════════════════════════════════════════
// services/transcripts — persistent library: CRUD, Postgres FTS,
// share links, exports. The sole tenancy-enforcement point for
// transcript data (every query is org-scoped by construction).
// ═══════════════════════════════════════════════════════════════
import { randomBytes } from 'node:crypto'
import type pg from 'pg'
import { getPool } from '@semaje/db'
import type { Principal, CreateTranscriptRequest } from '@semaje/schemas'
import { buildListQuery, buildGetQuery, buildDeleteQuery } from './queries.ts'

export { buildListQuery, buildGetQuery, buildDeleteQuery } from './queries.ts'
export * from './exports.ts'

export async function createTranscript(
  principal: Principal, req: CreateTranscriptRequest, pool: pg.Pool = getPool(),
) {
  const title = req.title
    || (req.text || '').split(/\s+/).slice(0, 8).join(' ').slice(0, 120)
    || 'Untitled'
  const res = await pool.query(
    `INSERT INTO transcripts
       (org_id, owner_id, title, source, task, language, duration_sec, text, segments, result, audio_blob_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      principal.orgId, principal.userId, title, req.source, req.task,
      req.language ?? null, req.durationSec ?? null, req.text,
      req.segments ? JSON.stringify(req.segments) : null,
      req.result != null ? JSON.stringify(req.result) : null,
      req.audioBlobId ?? null,
    ],
  )
  return res.rows[0]
}

export async function listTranscripts(
  principal: Principal, opts: { q?: string; limit: number; offset: number }, pool: pg.Pool = getPool(),
) {
  const { text, values } = buildListQuery(principal.orgId, opts)
  return (await pool.query(text, values)).rows
}

export async function getTranscript(principal: Principal, id: string, pool: pg.Pool = getPool()) {
  const { text, values } = buildGetQuery(principal.orgId, id)
  return (await pool.query(text, values)).rows[0] ?? null
}

export async function deleteTranscript(principal: Principal, id: string, pool: pg.Pool = getPool()) {
  const { text, values } = buildDeleteQuery(principal.orgId, id)
  return (await pool.query(text, values)).rows[0] ?? null
}

// ── Shares (Phase 1: public link shares) ─────────────────────
export function makeShareToken(): string {
  return randomBytes(20).toString('base64url')
}

export async function createShare(
  principal: Principal, transcriptId: string,
  opts: { permission?: string; expiresInDays?: number }, pool: pg.Pool = getPool(),
) {
  // Ownership check is org-scoped by construction.
  const t = await getTranscript(principal, transcriptId, pool)
  if (!t) return null
  const token = makeShareToken()
  const expires = opts.expiresInDays
    ? new Date(Date.now() + opts.expiresInDays * 86_400_000)
    : null
  const res = await pool.query(
    `INSERT INTO shares (transcript_id, kind, token, permission, expires_at)
     VALUES ($1, 'link', $2, $3, $4) RETURNING *`,
    [transcriptId, token, opts.permission || 'view', expires],
  )
  return res.rows[0]
}

/** Public share resolution — no principal; the token IS the credential. */
export async function getByShareToken(token: string, pool: pg.Pool = getPool()) {
  const res = await pool.query(
    `SELECT t.id, t.title, t.text, t.segments, t.task, t.language, t.duration_sec,
            t.created_at, s.permission, s.expires_at
     FROM shares s JOIN transcripts t ON t.id = s.transcript_id
     WHERE s.token = $1 AND (s.expires_at IS NULL OR s.expires_at > now())`,
    [token],
  )
  return res.rows[0] ?? null
}
