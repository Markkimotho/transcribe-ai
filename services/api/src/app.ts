// ═══════════════════════════════════════════════════════════════
// services/api — the HTTP gateway. Auth, validation, rate limits,
// uploads, jobs, transcripts, shares, API keys, legacy sync path.
// Exported as a factory so gate tests boot it with fakes.
// ═══════════════════════════════════════════════════════════════
import express, { type Express } from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { readFile, unlink } from 'node:fs/promises'
import { getPool } from '@semaje/db'
import {
  RegisterRequest, LoginRequest, CreateTranscriptRequest, ListTranscriptsQuery,
  CreateJobRequest, CreateApiKeyRequest, CreateShareRequest, CreateMeetingBotRunRequest,
  UpdateTranscriptRequest, RenameSpeakerRequest, GlossaryTermRequest,
  LlmSettingsRequest,
  KnowledgeSearchQuery, CollectionRequest, SavedSearchRequest, AskKnowledgeRequest,
  IngestRequest, type Principal,
} from '@semaje/schemas'
import {
  registerUser, loginUser, signAccessToken, signRefreshToken, verifyToken,
  generateApiKey, ensureSeed,
} from '../../auth/src/index.ts'
import { getStorage, audioKey } from '../../storage/src/index.ts'
import {
  createTranscript, listTranscripts, getTranscript, deleteTranscript,
  createShare, getByShareToken, exportTranscript, EXPORT_FORMATS, type ExportFormat,
  updateTranscript, renameTranscriptSpeaker, listTranscriptRevisions,
  listGlossary, upsertGlossaryTerm, deleteGlossaryTerm,
  applyGlossary, cleanupPunctuation, speakerLabels, summarizeQuality,
} from '../../transcripts/src/index.ts'
import { enqueueTranscribeJob, getJob, listJobs, retryJob } from '../../jobs/src/index.ts'
import { assertBotTransition, detectMeetingProvider } from '../../meeting-bot/src/index.ts'
import {
  whisperHealth, whisperTranscribe, whisperModels, whisperDownloadModel,
  whisperActivateModel, whisperDeleteModel,
} from '../../whisper/client/index.ts'
import { needsLlm, renderPlainTranscript, buildTranscriptContext } from '../../pipeline/src/index.ts'
import { createLlm, runWithFallback } from '../../llm/src/index.ts'
import { runMeetingWithFallback } from '../../llm/src/structured.ts'
import {
  getWorkspaceLlmConfig, saveWorkspaceLlmConfig, isLocalEndpoint,
} from '../../llm/src/settings.ts'
import {
  keywordSearch, semanticSearch, indexTranscriptEmbedding, locateTimestamp,
} from '../../search/src/index.ts'
import { GeminiAdapter } from '../../llm/src/adapters/gemini.ts'
import { requireAuth, requireScope, rateLimit, validate, errorHandler } from './middleware.ts'

export function createApp(opts: { enableJobs?: boolean } = {}): Express {
  const app = express()
  const enableJobs = opts.enableJobs !== false

  app.use(cors({
    origin: (process.env.CORS_ORIGINS
      || 'http://localhost:5173,http://localhost:4173').split(','),
    credentials: true,
  }))
  app.use(express.json({ limit: '2mb' }))

  const upload = multer({
    dest: process.env.UPLOAD_TMP_DIR || 'uploads/',
    limits: { fileSize: Number(process.env.UPLOAD_MAX_MB || 500) * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const extension = file.originalname.split('.').pop()?.toLowerCase()
      const supported = new Set(['mp3', 'wav', 'm4a', 'ogg', 'oga', 'flac', 'aac', 'webm', 'mp4', 'mov', 'mkv'])
      if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/') || supported.has(extension || '')) cb(null, true)
      else cb(new Error('Only audio and video files are supported.'))
    },
  })

  const persistUpload = async (file: Express.Multer.File, principal: Principal) => {
    const blobId = randomUUID()
    const ext = file.originalname.split('.').pop() || 'bin'
    const key = audioKey(principal.orgId, blobId, ext)
    const storage = await getStorage()
    await storage.put(key, await readFile(file.path), file.mimetype)
    const row = await getPool().query(
      `INSERT INTO audio_blobs (id, org_id, owner_id, storage_key, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, storage_key, mime_type, size_bytes`,
      [blobId, principal.orgId, principal.userId, key, file.mimetype, file.size],
    )
    return row.rows[0]
  }

  const parseJsonField = (value: unknown, fallback: unknown) => {
    if (value == null || value === '') return fallback
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) }
    catch {
      const error = new Error('Multipart options and captureMeta fields must contain valid JSON.') as Error & { status?: number }
      error.status = 400
      throw error
    }
  }

  // ── Health ─────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    const w = await whisperHealth()
    res.json({
      ok: true,
      name: 'semaje',
      mode: process.env.AUTH_ADAPTER || 'single-user',
      whisper: { reachable: !!(w as { backend?: string }).backend, backend: (w as { backend?: string }).backend ?? null },
      llmAdapter: process.env.LLM_ADAPTER || 'claude-local',
    })
  })

  // ── Auth ───────────────────────────────────────────────────
  app.post('/api/auth/register', validate(RegisterRequest), async (req, res, next) => {
    try {
      const p = await registerUser(req.body.email, req.body.password, req.body.displayName)
      res.status(201).json({
        accessToken: signAccessToken(p),
        refreshToken: signRefreshToken(p),
        user: { id: p.userId, email: req.body.email, displayName: req.body.displayName ?? null },
      })
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' })
      next(e)
    }
  })

  app.post('/api/auth/token', validate(LoginRequest), async (req, res, next) => {
    try {
      const p = await loginUser(req.body.email, req.body.password)
      res.json({
        accessToken: signAccessToken(p),
        refreshToken: signRefreshToken(p),
        user: { id: p.userId, email: req.body.email, displayName: null },
      })
    } catch (e) { next(e) }
  })

  app.post('/api/auth/refresh', async (req, res, next) => {
    try {
      const p = verifyToken(String(req.body?.refreshToken || ''), 'refresh')
      res.json({ accessToken: signAccessToken(p) })
    } catch (e) { next(e) }
  })

  app.get('/api/me', requireAuth(), rateLimit(), async (req, res) => {
    res.json({ principal: req.principal })
  })

  // ── Local STT model control plane ──────────────────────────
  app.get('/api/admin/stt', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      if (!['owner', 'admin'].includes(req.principal!.role)) return res.status(403).json({ error: 'Admin access required' })
      const runtime = await whisperModels()
      res.json({
        ...runtime,
        queue: {
          workerSlots: Math.max(1, Number(process.env.WORKER_CONCURRENCY || 1)),
          maxQueuedJobs: Math.max(1, Number(process.env.MAX_QUEUED_JOBS || 100)),
        },
      })
    } catch (e) { next(e) }
  })

  app.post('/api/admin/stt/models/download', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      if (!['owner', 'admin'].includes(req.principal!.role)) return res.status(403).json({ error: 'Admin access required' })
      res.json(await whisperDownloadModel(String(req.body?.backend || ''), String(req.body?.model || '')))
    } catch (e) { next(e) }
  })

  app.post('/api/admin/stt/models/activate', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      if (!['owner', 'admin'].includes(req.principal!.role)) return res.status(403).json({ error: 'Admin access required' })
      res.json(await whisperActivateModel(String(req.body?.backend || ''), String(req.body?.model || '')))
    } catch (e) { next(e) }
  })

  app.delete('/api/admin/stt/models/:backend/:model', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      if (!['owner', 'admin'].includes(req.principal!.role)) return res.status(403).json({ error: 'Admin access required' })
      res.json(await whisperDeleteModel(req.params.backend, req.params.model))
    } catch (e) { next(e) }
  })

  // ── Local meeting-intelligence runtime ─────────────────────
  app.get('/api/admin/llm', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      if (!['owner', 'admin'].includes(req.principal!.role)) return res.status(403).json({ error: 'Admin access required' })
      res.json({ config: await getWorkspaceLlmConfig(req.principal!.orgId) })
    } catch (e) { next(e) }
  })

  app.put('/api/admin/llm', requireAuth(), rateLimit(), validate(LlmSettingsRequest), async (req, res, next) => {
    try {
      if (!['owner', 'admin'].includes(req.principal!.role)) return res.status(403).json({ error: 'Admin access required' })
      if (req.body.endpoint && !isLocalEndpoint(req.body.endpoint)) {
        return res.status(400).json({ error: 'Local AI endpoints must resolve to localhost, a private network, or a compose service.' })
      }
      const saved = await saveWorkspaceLlmConfig(req.principal!.orgId, req.body)
      res.json({ config: saved.llm_config, updatedAt: saved.updated_at })
    } catch (e) { next(e) }
  })

  app.post('/api/admin/llm/test', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      if (!['owner', 'admin'].includes(req.principal!.role)) return res.status(403).json({ error: 'Admin access required' })
      const parsed = LlmSettingsRequest.safeParse(req.body?.config || await getWorkspaceLlmConfig(req.principal!.orgId))
      if (!parsed.success) return res.status(400).json({ error: 'Invalid local AI configuration' })
      if (parsed.data.endpoint && !isLocalEndpoint(parsed.data.endpoint)) {
        return res.status(400).json({ error: 'Endpoint is not local or private.' })
      }
      const adapter = createLlm(parsed.data.adapter, parsed.data)
      const output = await adapter.run('Reply with exactly: local intelligence ready', 'SYSTEM CHECK')
      res.json({ ok: true, output, runtime: adapter.lastRun })
    } catch (e) { next(e) }
  })

  // ── Uploads → audio_blobs ──────────────────────────────────
  app.post('/api/uploads', requireAuth(), requireScope('transcribe'), rateLimit(), upload.single('audio'), async (req, res, next) => {
    const tmpPath = req.file?.path
    try {
      if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })
      res.status(201).json({ audioBlob: await persistUpload(req.file, req.principal!) })
    } catch (e) { next(e) }
    finally { if (tmpPath) unlink(tmpPath).catch(() => {}) }
  })

  app.post('/api/uploads/presign', requireAuth(), requireScope('transcribe'), rateLimit(), async (req, res, next) => {
    try {
      const p = req.principal!
      const mimeType = String(req.body?.mimeType || 'audio/mpeg')
      const ext = String(req.body?.filename || 'audio.bin').split('.').pop() || 'bin'
      const blobId = randomUUID()
      const key = audioKey(p.orgId, blobId, ext)
      const storage = await getStorage()
      const presigned = await storage.presignUpload(key, mimeType)
      if (!presigned) return res.json({ presigned: null, fallback: '/api/uploads' })
      await getPool().query(
        `INSERT INTO audio_blobs (id, org_id, owner_id, storage_key, mime_type)
         VALUES ($1,$2,$3,$4,$5)`,
        [blobId, p.orgId, p.userId, key, mimeType],
      )
      res.json({ presigned, audioBlobId: blobId })
    } catch (e) { next(e) }
  })

  // ── Async jobs ─────────────────────────────────────────────
  app.post('/api/ingest', requireAuth(), requireScope('transcribe'), rateLimit(), upload.single('audio'), async (req, res, next) => {
    const tmpPath = req.file?.path
    try {
      if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })
      const idempotencyKey = String(req.body?.idempotencyKey || req.header('Idempotency-Key') || '') || undefined
      if (idempotencyKey) {
        const existing = await getPool().query(
          `SELECT * FROM jobs WHERE org_id = $1 AND ingest_key = $2`,
          [req.principal!.orgId, idempotencyKey],
        )
        if (existing.rows[0]) return res.status(200).json({ job: existing.rows[0], duplicate: true })
      }
      const parsed = IngestRequest.safeParse({
        task: req.body?.task || undefined,
        options: parseJsonField(req.body?.options, {}),
        language: req.body?.language || undefined,
        title: req.body?.title || req.file.originalname.replace(/\.[^.]+$/, ''),
        source: req.body?.source || undefined,
        webhookUrl: req.body?.webhookUrl || undefined,
        idempotencyKey,
        captureMeta: parseJsonField(req.body?.captureMeta, {}),
      })
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Invalid ingest request',
          details: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
        })
      }
      const blob = await persistUpload(req.file, req.principal!)
      const { webhookUrl, idempotencyKey: key, captureMeta, ...input } = parsed.data
      const job = await enqueueTranscribeJob(
        req.principal!, { ...input, audioBlobId: blob.id }, webhookUrl ?? null,
        {
          idempotencyKey: key,
          captureMeta: {
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            ...captureMeta,
          },
        },
      )
      res.status(202).json({ job, audioBlob: blob, duplicate: false })
    } catch (e) { next(e) }
    finally { if (tmpPath) unlink(tmpPath).catch(() => {}) }
  })

  if (enableJobs) {
    app.post('/api/jobs', requireAuth(), requireScope('transcribe'), rateLimit(), validate(CreateJobRequest), async (req, res, next) => {
      try {
        const { webhookUrl, idempotencyKey, captureMeta, ...input } = req.body
        const job = await enqueueTranscribeJob(req.principal!, input, webhookUrl ?? null, { idempotencyKey, captureMeta })
        res.status(202).json({ job })
      } catch (e) { next(e) }
    })
  }
  app.get('/api/jobs', requireAuth(), rateLimit(), async (req, res, next) => {
    try { res.json({ jobs: await listJobs(req.principal!, Number(req.query.limit || 30)) }) }
    catch (e) { next(e) }
  })
  app.get('/api/jobs/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const job = await getJob(req.principal!, req.params.id)
      if (!job) return res.status(404).json({ error: 'Job not found' })
      res.json({ job })
    } catch (e) { next(e) }
  })

  app.post('/api/jobs/:id/retry', requireAuth(), requireScope('transcribe'), rateLimit(), async (req, res, next) => {
    try {
      const job = await retryJob(req.principal!, req.params.id)
      if (!job) return res.status(404).json({ error: 'Failed job not found' })
      res.status(202).json({ job })
    } catch (e) { next(e) }
  })

  // ── Transcripts library ────────────────────────────────────
  app.post('/api/transcripts', requireAuth(), rateLimit(), validate(CreateTranscriptRequest), async (req, res, next) => {
    try { res.status(201).json({ transcript: await createTranscript(req.principal!, req.body) }) }
    catch (e) { next(e) }
  })

  app.get('/api/transcripts', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const q = ListTranscriptsQuery.safeParse(req.query)
      if (!q.success) return res.status(400).json({ error: 'Invalid query' })
      res.json({ transcripts: await listTranscripts(req.principal!, q.data) })
    } catch (e) { next(e) }
  })

  app.get('/api/transcripts/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const t = await getTranscript(req.principal!, req.params.id)
      if (!t) return res.status(404).json({ error: 'Transcript not found' })
      res.json({ transcript: t })
    } catch (e) { next(e) }
  })

  app.patch('/api/transcripts/:id', requireAuth(), rateLimit(), validate(UpdateTranscriptRequest), async (req, res, next) => {
    try {
      const transcript = await updateTranscript(req.principal!, req.params.id, req.body)
      if (!transcript) return res.status(404).json({ error: 'Transcript not found' })
      res.json({ transcript })
    } catch (e) { next(e) }
  })

  app.post('/api/transcripts/:id/speakers/:speaker', requireAuth(), rateLimit(), validate(RenameSpeakerRequest), async (req, res, next) => {
    try {
      const transcript = await renameTranscriptSpeaker(
        req.principal!, req.params.id, req.params.speaker, req.body.name,
      )
      if (!transcript) return res.status(404).json({ error: 'Transcript not found' })
      res.json({ transcript })
    } catch (e) { next(e) }
  })

  app.get('/api/transcripts/:id/revisions', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const revisions = await listTranscriptRevisions(req.principal!, req.params.id)
      if (!revisions) return res.status(404).json({ error: 'Transcript not found' })
      res.json({ revisions })
    } catch (e) { next(e) }
  })

  app.get('/api/transcripts/:id/audio', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const transcript = await getTranscript(req.principal!, req.params.id)
      if (!transcript) return res.status(404).json({ error: 'Transcript not found' })
      if (!transcript.audio_blob_id) return res.status(404).json({ error: 'Source audio is unavailable' })
      const blob = (await getPool().query(
        `SELECT storage_key, mime_type, size_bytes FROM audio_blobs WHERE id = $1 AND org_id = $2`,
        [transcript.audio_blob_id, req.principal!.orgId],
      )).rows[0]
      if (!blob) return res.status(404).json({ error: 'Source audio is unavailable' })
      const audio = await (await getStorage()).get(blob.storage_key)
      res.setHeader('Content-Type', blob.mime_type)
      res.setHeader('Content-Length', audio.byteLength)
      res.send(audio)
    } catch (e) { next(e) }
  })

  app.delete('/api/transcripts/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const gone = await deleteTranscript(req.principal!, req.params.id)
      if (!gone) return res.status(404).json({ error: 'Transcript not found' })
      res.json({ deleted: gone.id })
    } catch (e) { next(e) }
  })

  app.get('/api/glossary', requireAuth(), rateLimit(), async (req, res, next) => {
    try { res.json({ terms: await listGlossary(req.principal!) }) }
    catch (e) { next(e) }
  })

  app.post('/api/glossary', requireAuth(), rateLimit(), validate(GlossaryTermRequest), async (req, res, next) => {
    try {
      res.status(201).json({ term: await upsertGlossaryTerm(req.principal!, req.body.term, req.body.replacement) })
    } catch (e) { next(e) }
  })

  app.delete('/api/glossary/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const deleted = await deleteGlossaryTerm(req.principal!, req.params.id)
      if (!deleted) return res.status(404).json({ error: 'Glossary term not found' })
      res.json({ deleted: deleted.id })
    } catch (e) { next(e) }
  })

  // ── Local knowledge search ─────────────────────────────────
  app.get('/api/search', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const parsed = KnowledgeSearchQuery.safeParse(req.query)
      if (!parsed.success) return res.status(400).json({ error: 'Invalid search filters' })
      const { mode, ...filters } = parsed.data
      if (mode === 'semantic' && !filters.q.trim()) return res.status(400).json({ error: 'Semantic search requires a query' })
      const config = await getWorkspaceLlmConfig(req.principal!.orgId)
      const results = mode === 'semantic'
        ? await semanticSearch(req.principal!, filters.q, filters, {
            endpoint: config.endpoint, model: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
          })
        : await keywordSearch(req.principal!, filters)
      res.json({ results, mode })
    } catch (e) { next(e) }
  })

  app.get('/api/collections', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const rows = await getPool().query(
        `SELECT c.id, c.name, c.color, c.created_at, count(t.id)::int AS transcript_count
         FROM collections c LEFT JOIN transcripts t ON t.collection_id = c.id
         WHERE c.org_id = $1 GROUP BY c.id ORDER BY lower(c.name)`,
        [req.principal!.orgId],
      )
      res.json({ collections: rows.rows })
    } catch (e) { next(e) }
  })

  app.post('/api/collections', requireAuth(), rateLimit(), validate(CollectionRequest), async (req, res, next) => {
    try {
      const row = await getPool().query(
        `INSERT INTO collections (org_id, name, color) VALUES ($1,$2,$3)
         ON CONFLICT (org_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING *`,
        [req.principal!.orgId, req.body.name, req.body.color],
      )
      res.status(201).json({ collection: row.rows[0] })
    } catch (e) { next(e) }
  })

  app.delete('/api/collections/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const row = await getPool().query(
        `DELETE FROM collections WHERE org_id = $1 AND id = $2 RETURNING id`,
        [req.principal!.orgId, req.params.id],
      )
      if (!row.rows[0]) return res.status(404).json({ error: 'Collection not found' })
      res.json({ deleted: row.rows[0].id })
    } catch (e) { next(e) }
  })

  app.get('/api/saved-searches', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const rows = await getPool().query(
        `SELECT id, name, query, created_at FROM saved_searches
         WHERE org_id = $1 AND owner_id = $2 ORDER BY created_at DESC`,
        [req.principal!.orgId, req.principal!.userId],
      )
      res.json({ savedSearches: rows.rows })
    } catch (e) { next(e) }
  })

  app.post('/api/saved-searches', requireAuth(), rateLimit(), validate(SavedSearchRequest), async (req, res, next) => {
    try {
      const row = await getPool().query(
        `INSERT INTO saved_searches (org_id, owner_id, name, query) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.principal!.orgId, req.principal!.userId, req.body.name, JSON.stringify(req.body.query)],
      )
      res.status(201).json({ savedSearch: row.rows[0] })
    } catch (e) { next(e) }
  })

  app.delete('/api/saved-searches/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const row = await getPool().query(
        `DELETE FROM saved_searches WHERE org_id = $1 AND owner_id = $2 AND id = $3 RETURNING id`,
        [req.principal!.orgId, req.principal!.userId, req.params.id],
      )
      if (!row.rows[0]) return res.status(404).json({ error: 'Saved search not found' })
      res.json({ deleted: row.rows[0].id })
    } catch (e) { next(e) }
  })

  app.post('/api/search/index/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const transcript = await getTranscript(req.principal!, req.params.id)
      if (!transcript) return res.status(404).json({ error: 'Transcript not found' })
      const config = await getWorkspaceLlmConfig(req.principal!.orgId)
      const indexed = await indexTranscriptEmbedding(req.principal!, transcript, {
        endpoint: config.endpoint, model: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
      })
      res.json({ indexed })
    } catch (e) { next(e) }
  })

  app.post('/api/knowledge/ask', requireAuth(), rateLimit(), validate(AskKnowledgeRequest), async (req, res, next) => {
    try {
      const p = req.principal!
      let rows: any[]
      if (req.body.transcriptIds?.length) {
        rows = (await getPool().query(
          `SELECT id, title, text, segments FROM transcripts WHERE org_id = $1 AND id = ANY($2::uuid[]) LIMIT 30`,
          [p.orgId, req.body.transcriptIds],
        )).rows
      } else if (req.body.collectionId) {
        rows = (await getPool().query(
          `SELECT id, title, text, segments FROM transcripts
           WHERE org_id = $1 AND collection_id = $2 ORDER BY created_at DESC LIMIT 30`,
          [p.orgId, req.body.collectionId],
        )).rows
      } else {
        rows = await keywordSearch(p, { q: req.body.question, limit: 8 })
        if (!rows.length) rows = (await getPool().query(
          `SELECT id, title, text, segments FROM transcripts WHERE org_id = $1 ORDER BY created_at DESC LIMIT 8`,
          [p.orgId],
        )).rows
      }
      if (!rows.length) return res.status(404).json({ error: 'No transcripts are available for this question.' })
      const citations = rows.slice(0, 12).map(row => ({
        transcriptId: row.id, title: row.title,
        ...locateTimestamp(row.segments, req.body.question),
      }))
      const context = rows.slice(0, 12).map((row, index) => {
        const segments = (row.segments || []).slice(0, 120)
        const body = segments.length
          ? segments.map((segment: any) => `[${Math.floor(segment.start / 60)}:${String(Math.floor(segment.start % 60)).padStart(2, '0')}] ${segment.text}`).join('\n')
          : String(row.text).slice(0, 30_000)
        return `SOURCE ${index + 1} — ${row.title} (${row.id})\n${body}`
      }).join('\n\n')
      const config = await getWorkspaceLlmConfig(p.orgId)
      const generated = await runWithFallback(
        config,
        `Answer the question using only the supplied transcript sources. Cite sources inline as [1], [2], etc. Say when the evidence is insufficient. QUESTION: ${req.body.question}`,
        context,
      )
      res.json({ answer: generated.text, citations, runtime: generated.meta })
    } catch (e) { next(e) }
  })

  app.get('/api/transcripts/:id/export/:format', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const format = req.params.format as ExportFormat
      if (!EXPORT_FORMATS.includes(format)) return res.status(400).json({ error: `format must be one of ${EXPORT_FORMATS.join(', ')}` })
      const t = await getTranscript(req.principal!, req.params.id)
      if (!t) return res.status(404).json({ error: 'Transcript not found' })
      const { body, mimeType } = exportTranscript(format, { title: t.title, text: t.text, segments: t.segments })
      res.setHeader('Content-Type', mimeType)
      res.setHeader('Content-Disposition', `attachment; filename="${t.title.replace(/[^\w.-]+/g, '_').slice(0, 60)}.${format}"`)
      res.send(body)
    } catch (e) { next(e) }
  })

  // ── Shares ─────────────────────────────────────────────────
  app.post('/api/transcripts/:id/shares', requireAuth(), rateLimit(), validate(CreateShareRequest), async (req, res, next) => {
    try {
      const share = await createShare(req.principal!, req.params.id, req.body)
      if (!share) return res.status(404).json({ error: 'Transcript not found' })
      res.status(201).json({ share })
    } catch (e) { next(e) }
  })

  app.get('/api/share/:token', async (req, res, next) => {
    try {
      const t = await getByShareToken(req.params.token)
      if (!t) return res.status(404).json({ error: 'Share not found or expired' })
      res.json({ transcript: t })
    } catch (e) { next(e) }
  })

  // ── API keys ───────────────────────────────────────────────
  app.post('/api/api-keys', requireAuth(), rateLimit(), validate(CreateApiKeyRequest), async (req, res, next) => {
    try {
      const p = req.principal!
      const k = generateApiKey()
      const row = await getPool().query(
        `INSERT INTO api_keys (org_id, owner_id, name, key_prefix, key_hash, scopes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, key_prefix, scopes, created_at`,
        [p.orgId, p.userId, req.body.name, k.prefix, k.hash, req.body.scopes],
      )
      res.status(201).json({ apiKey: row.rows[0], token: k.token }) // token shown once
    } catch (e) { next(e) }
  })

  app.get('/api/api-keys', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const rows = await getPool().query(
        `SELECT id, name, key_prefix, scopes, last_used_at, created_at
         FROM api_keys WHERE org_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
        [req.principal!.orgId],
      )
      res.json({ apiKeys: rows.rows })
    } catch (e) { next(e) }
  })

  app.delete('/api/api-keys/:id', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      await getPool().query(
        `UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND org_id = $2`,
        [req.params.id, req.principal!.orgId],
      )
      res.json({ revoked: req.params.id })
    } catch (e) { next(e) }
  })

  // ── Meeting bot runs ──────────────────────────────────────
  app.post('/api/meeting-bot/runs', requireAuth(), rateLimit(), validate(CreateMeetingBotRunRequest), async (req, res, next) => {
    try {
      const p = req.principal!
      let provider: 'zoom' | 'meet' | 'teams'
      try {
        provider = req.body.provider || detectMeetingProvider(req.body.joinUrl)
      } catch {
        return res.status(400).json({ error: 'Unsupported meeting provider. Use a Zoom, Google Meet, or Microsoft Teams URL.' })
      }
      const row = await getPool().query(
        `INSERT INTO meeting_bot_runs (org_id, calendar_event_id, provider, join_url, state)
         VALUES ($1, $2, $3, $4, 'invited')
         RETURNING id, org_id, calendar_event_id, provider, join_url, state, job_id, transcript_id, error, created_at, updated_at, started_at, finished_at`,
        [p.orgId, req.body.startsAt || '', provider, req.body.joinUrl],
      )
      res.status(201).json({ run: row.rows[0] })
    } catch (e) { next(e) }
  })

  app.get('/api/meeting-bot/runs', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const rows = await getPool().query(
        `SELECT id, org_id, calendar_event_id, provider, join_url, state, job_id, transcript_id, error, created_at, updated_at, started_at, finished_at
         FROM meeting_bot_runs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.principal!.orgId],
      )
      res.json({ runs: rows.rows })
    } catch (e) { next(e) }
  })

  app.post('/api/meeting-bot/runs/:id/start', requireAuth(), rateLimit(), async (req, res, next) => {
    try {
      const p = req.principal!
      const found = await getPool().query(
        `SELECT id, org_id, calendar_event_id, provider, join_url, state, job_id, transcript_id, error, created_at, updated_at, started_at, finished_at
         FROM meeting_bot_runs WHERE org_id = $1 AND id = $2`,
        [p.orgId, req.params.id],
      )
      const run = found.rows[0]
      if (!run) return res.status(404).json({ error: 'Bot run not found' })
      if (run.state !== 'invited') return res.status(409).json({ error: `Bot run is already ${run.state}.` })

      assertBotTransition('invited', 'joined')
      assertBotTransition('joined', 'recording')
      assertBotTransition('recording', 'left')

      const transcript = await createTranscript(p, {
        title: `${String(run.provider).toUpperCase()} meeting bot notes`,
        source: 'meeting',
        task: 'meeting',
        text: [
          `Meeting bot joined ${run.join_url}.`,
          '',
          `Provider: ${run.provider}`,
          'Status: local self-host run completed.',
          '',
          'Live media capture is ready to be attached once calendar and meeting-provider credentials are configured.',
        ].join('\n'),
        result: {
          summary: 'The meeting bot lifecycle completed in local self-host mode.',
          actionItems: [
            'Connect Google, Zoom, or Microsoft credentials for live meeting media capture.',
            'Route completed meeting notes from the Meetings notebook.',
          ],
        },
      })

      const updated = await getPool().query(
        `UPDATE meeting_bot_runs
         SET state = 'left', transcript_id = $3, started_at = COALESCE(started_at, now()), finished_at = now(), updated_at = now()
         WHERE org_id = $1 AND id = $2
         RETURNING id, org_id, calendar_event_id, provider, join_url, state, job_id, transcript_id, error, created_at, updated_at, started_at, finished_at`,
        [p.orgId, req.params.id, transcript.id],
      )
      res.json({ run: updated.rows[0], transcript, mode: 'simulated' })
    } catch (e) { next(e) }
  })

  // ── Legacy sync transcribe (small files, no persistence) ───
  // Kept for the existing web UI + BYO-key mode. Auth applies in
  // local-db mode; single-user mode works credential-free as before.
  const syncTranscribe = async (req: express.Request, res: express.Response, geminiKey?: string) => {
    const filePath = req.file?.path
    try {
      if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })
      const task = String(req.body.task || 'transcription')
      let options: Record<string, unknown> = {}
      try { options = JSON.parse(req.body.options || '{}') } catch { /* default */ }

      let whisper = await whisperTranscribe(
        await readFile(filePath!), req.file.originalname || 'audio.bin',
        req.file.mimetype, {
          language: req.body.language || undefined,
          diarize: task === 'diarization' || options.speakerLabels === true,
        },
      )
      const glossaryTerms = (await getPool().query(
        `SELECT term, replacement FROM glossary_terms WHERE org_id = $1 ORDER BY length(term) DESC`,
        [req.principal!.orgId],
      )).rows
      const glossaryResult = applyGlossary(whisper, glossaryTerms)
      whisper = options.polish ? cleanupPunctuation(glossaryResult) : glossaryResult
      const qualityMeta = summarizeQuality(whisper, glossaryResult.glossaryMatches)

      let transcript: string
      let enrichedResult: unknown = null
      let llmMeta: unknown = null
      if (!needsLlm(task, options)) {
        transcript = renderPlainTranscript(whisper, options)
      } else {
        const ctx = buildTranscriptContext(task, whisper)
        if (geminiKey) {
          const prompt = String(req.body.prompt || '')
          if (!prompt) return res.status(400).json({ error: 'No task prompt provided.' })
          const llm = new GeminiAdapter(geminiKey)
          transcript = await llm.run(prompt, ctx)
        } else {
          const config = await getWorkspaceLlmConfig(req.principal!.orgId)
          if (task === 'meeting') {
            const enriched = await runMeetingWithFallback(config, ctx, config.preset)
            transcript = whisper.text
            enrichedResult = enriched.result
            llmMeta = { ...enriched.meta, fallbackUsed: enriched.fallbackUsed }
          } else {
            const prompt = String(req.body.prompt || '')
            if (!prompt) return res.status(400).json({ error: 'No task prompt provided.' })
            const generated = await runWithFallback(config, prompt, ctx)
            transcript = generated.text
            enrichedResult = task === 'transcription' ? null : generated.text
            llmMeta = { ...generated.meta, fallbackUsed: generated.fallbackUsed }
          }
        }
      }
      res.json({
        transcript,
        whisper: { language: whisper.language, duration: whisper.duration, segments: whisper.segments },
        qualityMeta,
        speakerLabels: speakerLabels(whisper.segments),
        result: enrichedResult,
        processingMeta: llmMeta ? { llm: llmMeta } : {},
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Transcription failed.' })
    } finally {
      if (filePath) unlink(filePath).catch(() => {})
    }
  }

  app.post('/api/transcribe', requireAuth(), rateLimit(), upload.single('audio'),
    (req, res) => syncTranscribe(req, res))
  app.post('/api/transcribe-direct', requireAuth(), rateLimit(), upload.single('audio'),
    (req, res) => syncTranscribe(req, res, String(req.body.apiKey || '')))

  app.use(errorHandler())
  return app
}

export { ensureSeed }
