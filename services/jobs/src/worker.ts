// The transcription worker — consumes the queue and runs the full pipeline:
// storage → whisper → pipeline routing → (llm?) → transcripts. Progress and
// state land on the user-facing jobs row; webhook fires on terminal states.
import type pg from 'pg'
import { getPool } from '@semaje/db'
import { JobInput } from '@semaje/schemas'
import { getStorage } from '../../storage/src/index.ts'
import { whisperTranscribe } from '../../whisper/client/index.ts'
import { needsLlm, renderPlainTranscript, buildTranscriptContext } from '../../pipeline/src/index.ts'
import { getLlm } from '../../llm/src/index.ts'
import { createTranscript } from '../../transcripts/src/index.ts'
import { getBoss, markJob, notifyWebhook, QUEUE_TRANSCRIBE } from './index.ts'
// @ts-ignore — plain JS prompt library (single source of task prompts)
import { buildPrompt } from '../../../src/utils/promptBuilder.js'

export async function processJob(jobId: string, pool: pg.Pool = getPool()): Promise<void> {
  const found = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId])
  const job = found.rows[0]
  if (!job || job.status !== 'queued') return

  const running = await markJob(jobId, 'queued', 'running', {}, pool)
  if (!running) return

  try {
    const input = JobInput.parse(job.input)
    const principal = {
      userId: job.owner_id, orgId: job.org_id,
      role: 'owner' as const, scopes: [], via: 'jwt' as const,
    }

    // 1. Fetch audio from storage
    const blobRow = (await pool.query(
      `SELECT * FROM audio_blobs WHERE id = $1 AND org_id = $2`,
      [input.audioBlobId, job.org_id],
    )).rows[0]
    if (!blobRow) throw new Error(`audio blob ${input.audioBlobId} not found`)
    const storage = await getStorage()
    const audio = await storage.get(blobRow.storage_key)
    await pool.query(`UPDATE jobs SET progress = 20 WHERE id = $1`, [jobId])

    // 2. Whisper STT
    const whisper = await whisperTranscribe(
      audio, blobRow.storage_key.split('/').pop() || 'audio.bin', blobRow.mime_type,
      { language: input.language },
    )
    await pool.query(`UPDATE jobs SET progress = 70 WHERE id = $1`, [jobId])

    // 3. Route: plain Whisper or LLM task
    let text: string
    let result: unknown = null
    if (!needsLlm(input.task, input.options)) {
      text = renderPlainTranscript(whisper, input.options)
    } else {
      const prompt = buildPrompt(input.task, input.options)
      const ctx = buildTranscriptContext(input.task, whisper)
      const out = await getLlm().run(prompt, ctx)
      text = input.task === 'transcription' ? out : whisper.text
      result = input.task === 'transcription' ? null : out
    }
    await pool.query(`UPDATE jobs SET progress = 90 WHERE id = $1`, [jobId])

    // 4. Persist transcript
    const transcript = await createTranscript(principal, {
      title: input.title,
      source: input.source,
      task: input.task,
      language: whisper.language,
      durationSec: whisper.duration,
      text,
      segments: whisper.segments,
      result,
      audioBlobId: input.audioBlobId,
    }, pool)

    const done = await markJob(jobId, 'running', 'succeeded',
      { transcript_id: transcript.id, progress: 100 }, pool)
    if (done) await notifyWebhook(done)
  } catch (e: any) {
    console.error(`[worker] job ${jobId} failed:`, e.message)
    const failed = await markJob(jobId, 'running', 'failed', { error: e.message }, pool)
    if (failed) await notifyWebhook(failed)
  }
}

export async function startWorker(): Promise<void> {
  const boss = await getBoss()
  const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || 1))
  for (let slot = 0; slot < concurrency; slot += 1) {
    await boss.work(QUEUE_TRANSCRIBE, { batchSize: 1 }, async (jobs) => {
      for (const j of jobs) {
        const { jobId } = j.data as { jobId: string }
        await processJob(jobId)
      }
    })
  }
  console.log(`semaje worker consuming ${QUEUE_TRANSCRIBE} with ${concurrency} slot(s)`)
}
