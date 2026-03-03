import express from 'express'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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
  res.json({ ok: true, mode: 'proxy', keyConfigured: !!process.env.GEMINI_API_KEY })
})

// ── Transcribe ───────────────────────────────────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(500).json({
      error: 'Server not configured — add GEMINI_API_KEY to .env'
    })

    const prompt = req.body.prompt
    if (!prompt) return res.status(400).json({ error: 'No prompt provided.' })

    const base64Audio = readFileSync(filePath).toString('base64')
    const mimeType = req.file.mimetype || 'audio/mpeg'
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

    const payload = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Audio } }
        ]
      }],
      generationConfig: { maxOutputTokens: 16384 }
    })

    // Retry up to 3 times with backoff for rate limits
    let lastError
    for (let attempt = 0; attempt < 3; attempt++) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }
      )

      const data = await geminiRes.json()

      if (geminiRes.status === 429) {
        const wait = (attempt + 1) * 15_000 // 15s, 30s, 45s
        console.log(`[Rate limited] Retrying in ${wait / 1000}s (attempt ${attempt + 1}/3)`)
        await new Promise(r => setTimeout(r, wait))
        lastError = data?.error?.message || 'Rate limited'
        continue
      }

      if (!geminiRes.ok) throw new Error(data?.error?.message || `Gemini API error ${geminiRes.status}`)

      const transcript = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
      if (!transcript) throw new Error('No text returned from Gemini')
      return res.json({ transcript })
    }
    throw new Error(`Rate limited after 3 retries: ${lastError}`)

  } catch (err) {
    console.error('[Transcription error]', err)
    res.status(500).json({ error: err.message || 'Transcription failed.' })
  } finally {
    if (filePath && existsSync(filePath)) {
      try { unlinkSync(filePath) } catch (_) {}
    }
  }
})

// ── Direct-mode relay (user supplies their own key) ──────────
// Bypasses browser CORS restrictions by relaying through the server.
// The user's key is used per-request and never stored.
app.post('/api/transcribe-direct', upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided.' })

    const userKey = req.body.apiKey
    if (!userKey) return res.status(400).json({ error: 'No API key provided.' })

    const prompt = req.body.prompt
    if (!prompt) return res.status(400).json({ error: 'No prompt provided.' })

    const base64Audio = readFileSync(filePath).toString('base64')
    const mimeType = req.file.mimetype || 'audio/mpeg'
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

    const payload = JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Audio } }
        ]
      }],
      generationConfig: { maxOutputTokens: 16384 }
    })

    let lastError
    for (let attempt = 0; attempt < 3; attempt++) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }
      )

      const data = await geminiRes.json()

      if (geminiRes.status === 429) {
        const wait = (attempt + 1) * 15_000
        console.log(`[Direct relay — rate limited] Retrying in ${wait / 1000}s`)
        await new Promise(r => setTimeout(r, wait))
        lastError = data?.error?.message || 'Rate limited'
        continue
      }

      if (!geminiRes.ok) throw new Error(data?.error?.message || `Gemini API error ${geminiRes.status}`)

      const transcript = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
      if (!transcript) throw new Error('No text returned from Gemini')
      return res.json({ transcript })
    }
    throw new Error(`Rate limited after 3 retries: ${lastError}`)

  } catch (err) {
    console.error('[Direct relay error]', err)
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
  console.log(`   API key: ${process.env.GEMINI_API_KEY ? '✅ set' : '❌ NOT SET'}`)
})
