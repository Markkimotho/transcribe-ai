// semaje API entrypoint — HTTP + WS + (optionally) static frontend.
import 'dotenv/config'
import { createServer } from 'node:http'
import express from 'express'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { attachRealtime } from '../../realtime/src/ws-server.ts'
import { whisperHealth } from '../../whisper/client/index.ts'
import { ensureSeed } from '../../auth/src/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3001)

const app = createApp()

// Serve the built frontend when co-hosted (compose uses nginx instead).
if (process.env.SERVE_FRONTEND !== 'false') {
  const dist = join(__dirname, '../../../dist')
  app.use(express.static(dist))
  app.get('{*splat}', (_req, res) => { res.sendFile(join(dist, 'index.html')) })
}

const server = createServer(app)
attachRealtime(server)

server.listen(PORT, async () => {
  console.log(`\n🎙  semaje api → http://localhost:${PORT}  (ws: /ws)`)
  if ((process.env.AUTH_ADAPTER || 'single-user') === 'single-user') {
    try { await ensureSeed(); console.log('   auth: single-user (seeded default org)') }
    catch (e: any) { console.log(`   auth: single-user (seed pending: ${e.message})`) }
  } else {
    console.log(`   auth: ${process.env.AUTH_ADAPTER}`)
  }
  const w = await whisperHealth()
  console.log(`   whisper: ${(w as { backend?: string }).backend ? `✅ ${(w as { backend?: string }).backend}` : '❌ not reachable'}`)
  console.log(`   llm: ${process.env.LLM_ADAPTER || 'claude-local'}`)
  console.log(`   storage: ${process.env.STORAGE_ADAPTER || 'fs'}`)
})
