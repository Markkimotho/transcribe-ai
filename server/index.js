import express from 'express'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import { unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { transcribeAudio, whisperHealth } from './whisperClient.js'
import { runGeminiOnText } from './gemini.js'
import { needsGemini, renderPlainTranscript, buildTranscriptContext } from './pipeline.js'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// ── Temp uploads folder ──────────────────────────────────────
const uploadsDir = join(__dirname, '../uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only audio and video files are supported.'))
    }
  },
})

// Parse the optional options JSON blob the frontend sends.
function parseOptions(raw) {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

// ── Shared pipeline: Whisper STT → (optionally) Gemini over text ──
// `apiKey` is the Gemini key to use (server key in proxy mode, user key in direct mode).
async function runPipeline({ filePath, mimeType, task, options, prompt, language, geminiKey }) {
  // Stage 1 — Whisper always transcribes the audio.
  const whisper = await transcribeAudio(filePath, mimeType, { language, task: 'transcribe' })

  // Stage 2 — pure transcription returns Whisper directly; tasks go to Gemini.
  if (!needsGemini(task, options)) {
    return renderPlainTranscript(whisper, options)
  }

  if (!geminiKey) {
    throw new Error('This task needs Gemini for post-processing, but no Gemini key is configured.')
  }
  if (!prompt) throw new Error('No task prompt provided.')

  const context = buildTranscriptContext(task, whisper)
  return runGeminiOnText(prompt, context, geminiKey)
}

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const whisper = await whisperHealth()
  res.json({
    ok: true,
    mode: 'whisper+gemini',
    whisper: { reachable: !!whisper.backend, backend: whisper.backend || null, model: whisper.model || null },
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
  })
})

// ── Proxy mode (server's Gemini key) ─────────────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })

    const task = req.body.task || 'transcription'
    const options = parseOptions(req.body.options)
    const transcript = await runPipeline({
      filePath,
      mimeType: req.file.mimetype,
      task,
      options,
      prompt: req.body.prompt,
      language: req.body.language || '',
      geminiKey: process.env.GEMINI_API_KEY,
    })
    return res.json({ transcript })
  } catch (err) {
    console.error('[Transcription error]', err)
    res.status(500).json({ error: err.message || 'Transcription failed.' })
  } finally {
    if (filePath && existsSync(filePath)) {
      try { unlinkSync(filePath) } catch { /* ignore */ }
    }
  }
})

// ── Direct mode (user supplies their own Gemini key) ─────────
// Whisper still runs locally on the server; the user's key is used only
// for the Gemini post-processing step and is never stored.
app.post('/api/transcribe-direct', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })

    const task = req.body.task || 'transcription'
    const options = parseOptions(req.body.options)
    const transcript = await runPipeline({
      filePath,
      mimeType: req.file.mimetype,
      task,
      options,
      prompt: req.body.prompt,
      language: req.body.language || '',
      geminiKey: req.body.apiKey,
    })
    return res.json({ transcript })
  } catch (err) {
    console.error('[Direct pipeline error]', err)
    res.status(500).json({ error: err.message || 'Transcription failed.' })
  } finally {
    if (filePath && existsSync(filePath)) {
      try { unlinkSync(filePath) } catch { /* ignore */ }
    }
  }
})

// ── Serve built frontend in production ───────────────────────
app.use(express.static(join(__dirname, '../dist')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'))
})

app.listen(PORT, async () => {
  console.log(`\n🎙  Voxail server → http://localhost:${PORT}`)
  const w = await whisperHealth()
  console.log(`   Whisper STT: ${w.backend ? `✅ ${w.backend} (${w.model})` : '❌ not reachable — start services/whisper'}`)
  console.log(`   Gemini key (tasks): ${process.env.GEMINI_API_KEY ? '✅ set' : '❌ NOT SET (task features disabled)'}`)
})
