// Pure job state machine — the only legal transitions. Gate-tested.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { JobStatus } from '@semaje/schemas'

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['running', 'canceled'],
  running: ['succeeded', 'failed', 'canceled'],
  succeeded: [],
  failed: ['queued'],        // manual retry re-queues
  canceled: [],
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return (TRANSITIONS[from] || []).includes(to)
}

export function assertTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal job transition ${from} → ${to}`)
  }
}

/** Webhook payload shape — stable contract for external consumers. */
export function buildWebhookPayload(job: {
  id: string; status: JobStatus; transcript_id: string | null; error: string | null
}): { event: string; jobId: string; status: JobStatus; transcriptId: string | null; error: string | null; ts: string } {
  return {
    event: `job.${job.status}`,
    jobId: job.id,
    status: job.status,
    transcriptId: job.transcript_id,
    error: job.error,
    ts: new Date().toISOString(),
  }
}

export function signWebhookBody(body: string, secret: string, ts = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
  return `t=${ts},v1=${sig}`
}

export function verifyWebhookSignature(body: string, header: string, secret: string, toleranceSec = 300): boolean {
  const entries = header.split(',').map(part => {
    const [key, value] = part.split('=')
    return [key, value]
  })
  const parts = Object.fromEntries(entries)
  const ts = Number(parts.t)
  if (!Number.isFinite(ts) || !parts.v1) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSec) return false
  const expected = signWebhookBody(body, secret, ts).split('v1=')[1]
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(parts.v1, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function nextWebhookDelayMs(attempt: number): number {
  const capped = Math.min(Math.max(attempt, 0), 8)
  return Math.min(60_000, 1_000 * 2 ** capped)
}
