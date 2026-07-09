// ═══════════════════════════════════════════════════════════════
// services/jobs — async transcription jobs on pg-boss (Postgres-
// backed queue: no Redis for self-host). API enqueues; the worker
// (worker.ts) consumes; status is polled from the jobs table.
// ═══════════════════════════════════════════════════════════════
import PgBoss from 'pg-boss'
import type pg from 'pg'
import { getPool } from '@semaje/db'
import type { Principal, JobInput } from '@semaje/schemas'
import { assertTransition, buildWebhookPayload } from './state.ts'

export { canTransition, assertTransition, buildWebhookPayload } from './state.ts'

export const QUEUE_TRANSCRIBE = 'transcribe'

let boss: PgBoss | null = null

export async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL || 'postgres://semaje:semaje@localhost:5432/semaje')
    boss.on('error', e => console.error('[pg-boss]', e.message))
    await boss.start()
    await boss.createQueue(QUEUE_TRANSCRIBE)
  }
  return boss
}

export async function stopBoss(): Promise<void> {
  if (boss) { await boss.stop(); boss = null }
}

/** Creates the user-facing job row and enqueues the work. */
export async function enqueueTranscribeJob(
  principal: Principal, input: JobInput, webhookUrl: string | null,
  pool: pg.Pool = getPool(),
) {
  const res = await pool.query(
    `INSERT INTO jobs (org_id, owner_id, type, status, input, webhook_url)
     VALUES ($1, $2, 'transcribe', 'queued', $3, $4) RETURNING *`,
    [principal.orgId, principal.userId, JSON.stringify(input), webhookUrl],
  )
  const job = res.rows[0]
  const b = await getBoss()
  await b.send(QUEUE_TRANSCRIBE, { jobId: job.id })
  return job
}

export async function getJob(principal: Principal, id: string, pool: pg.Pool = getPool()) {
  const res = await pool.query(
    `SELECT * FROM jobs WHERE org_id = $1 AND id = $2`,
    [principal.orgId, id],
  )
  return res.rows[0] ?? null
}

export async function markJob(
  id: string, from: string, to: string,
  patch: { transcript_id?: string; error?: string; progress?: number } = {},
  pool: pg.Pool = getPool(),
) {
  assertTransition(from as never, to as never)
  const res = await pool.query(
    `UPDATE jobs SET status = $2,
       transcript_id = COALESCE($3, transcript_id),
       error = $4,
       progress = COALESCE($5, progress),
       started_at = CASE WHEN $2 = 'running' THEN now() ELSE started_at END,
       finished_at = CASE WHEN $2 IN ('succeeded','failed','canceled') THEN now() ELSE finished_at END,
       attempts = attempts + CASE WHEN $2 = 'running' THEN 1 ELSE 0 END
     WHERE id = $1 AND status = $6 RETURNING *`,
    [id, to, patch.transcript_id ?? null, patch.error ?? null, patch.progress ?? null, from],
  )
  return res.rows[0] ?? null
}

/** Fire-and-forget webhook on terminal states. */
export async function notifyWebhook(job: {
  id: string; status: never; transcript_id: string | null; error: string | null; webhook_url: string | null
}): Promise<void> {
  if (!job.webhook_url) return
  const payload = buildWebhookPayload(job)
  try {
    await fetch(job.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e: any) {
    console.warn(`[webhook] delivery failed for job ${job.id}: ${e.message}`)
  }
}
