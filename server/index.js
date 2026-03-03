import express from 'express'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'

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
  }
})

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'proxy', keyConfigured: !!process.env.ANTHROPIC_API_KEY })
})

// ── Transcribe ───────────────────────────────────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({
      error: 'Server not configured — add ANTHROPIC_API_KEY to .env'
    })

    const prompt = req.body.prompt
    if (!prompt) return res.status(400).json({ error: 'No prompt provided.' })

    const client = new Anthropic({ apiKey })
    const base64Audio = readFileSync(filePath).toString('base64')
    const mimeType = req.file.mimetype || 'audio/mpeg'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'document', source: { type: 'base64', media_type: mimeType, data: base64Audio } }
        ]
      }]
    })

    const transcript = response.content.map(b => b.text || '').join('').trim()
    res.json({ transcript })

  } catch (err) {
    console.error('[Transcription error]', err)
    res.status(500).json({ error: err.message || 'Transcription failed.' })
  } finally {
    if (filePath && existsSync(filePath)) {
      try { unlinkSync(filePath) } catch (_) {}
    }
  }
})

// ── Serve built frontend in production ───────────────────────
app.use(express.static(join(__dirname, '../dist')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`\n🎙  Voxail server → http://localhost:${PORT}`)
  console.log(`   API key: ${process.env.ANTHROPIC_API_KEY ? '✅ set' : '❌ NOT SET'}`)
})
