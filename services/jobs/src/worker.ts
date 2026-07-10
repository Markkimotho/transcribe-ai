// The transcription worker — consumes the queue and runs the full pipeline:
// storage → whisper → pipeline routing → (llm?) → transcripts. Progress and
// state land on the user-facing jobs row; webhook fires on terminal states.
import type pg from 'pg'
import { getPool } from '@semaje/db'
import { JobInput } from '@semaje/schemas'
import { getStorage } from '../../storage/src/index.ts'
import { whisperTranscribe } from '../../whisper/client/index.ts'
import { needsLlm, renderPlainTranscript, buildTranscriptContext } from '../../pipeline/src/index.ts'
import { runWithFallback } from '../../llm/src/index.ts'
import { runMeetingWithFallback } from '../../llm/src/structured.ts'
import { getWorkspaceLlmConfig } from '../../llm/src/settings.ts'
import { createTranscript } from '../../transcripts/src/index.ts'
import {
  applyGlossary, cleanupPunctuation, speakerLabels, summarizeQuality,
} from '../../transcripts/src/quality.ts'
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
    const sttStartedAt = performance.now()
    let whisper = await whisperTranscribe(
      audio, blobRow.storage_key.split('/').pop() || 'audio.bin', blobRow.mime_type,
      {
        language: input.language,
        diarize: input.task === 'diarization' || input.options.speakerLabels === true,
      },
    )
    const glossaryTerms = (await pool.query(
      `SELECT term, replacement FROM glossary_terms WHERE org_id = $1 ORDER BY length(term) DESC`,
      [job.org_id],
    )).rows
    const glossaryResult = applyGlossary(whisper, glossaryTerms)
    whisper = input.options.polish ? cleanupPunctuation(glossaryResult) : glossaryResult
    const qualityMeta = summarizeQuality(whisper, glossaryResult.glossaryMatches)
    const runtimeSec = (performance.now() - sttStartedAt) / 1000
    const processingMeta: Record<string, unknown> = {
      backend: whisper.backend,
      model: whisper.model,
      language: whisper.language,
      durationSec: whisper.duration,
      runtimeSec: Number(runtimeSec.toFixed(3)),
      realtimeFactor: Number((runtimeSec / Math.max(whisper.duration, 0.001)).toFixed(3)),
      device: process.env.WHISPER_DEVICE || 'auto',
    }
    await pool.query(
      `UPDATE jobs SET progress = 70, processing_meta = processing_meta || $2::jsonb WHERE id = $1`,
      [jobId, JSON.stringify(processingMeta)],
    )

    // 3. Route: plain Whisper or LLM task
    let text: string
    let result: unknown = null
    if (!needsLlm(input.task, input.options)) {
      text = renderPlainTranscript(whisper, input.options)
    } else {
      const ctx = buildTranscriptContext(input.task, whisper)
      const config = await getWorkspaceLlmConfig(job.org_id, pool)
      if (input.task === 'meeting') {
        const enriched = await runMeetingWithFallback(config, ctx, config.preset)
        text = whisper.text
        result = enriched.result
        processingMeta.llm = { ...enriched.meta, fallbackUsed: enriched.fallbackUsed }
      } else {
        const prompt = buildPrompt(input.task, input.options)
        const generated = await runWithFallback(config, prompt, ctx)
        text = input.task === 'transcription' ? generated.text : whisper.text
        result = input.task === 'transcription' ? null : generated.text
        processingMeta.llm = { ...generated.meta, fallbackUsed: generated.fallbackUsed }
      }
    }
    await pool.query(
      `UPDATE jobs SET progress = 90, processing_meta = $2::jsonb WHERE id = $1`,
      [jobId, JSON.stringify(processingMeta)],
    )

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
      speakerLabels: speakerLabels(whisper.segments),
      qualityMeta,
    }, pool)
    await pool.query(
      `UPDATE transcripts SET processing_meta = $2::jsonb WHERE id = $1`,
      [transcript.id, JSON.stringify(processingMeta)],
    )

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
