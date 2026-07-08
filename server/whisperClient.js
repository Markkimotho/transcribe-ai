// Thin client for the Whisper STT service (services/whisper). The ONLY
// place the Node server talks to Whisper. See services/whisper/contract.md.
import { readFile } from 'fs/promises'
import { basename } from 'path'

const WHISPER_URL = process.env.WHISPER_URL || 'http://localhost:8011'

export async function whisperHealth() {
  try {
    const res = await fetch(`${WHISPER_URL}/health`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return { ok: false }
    return await res.json()
  } catch {
    return { ok: false }
  }
}

// Sends the uploaded file to the Whisper service and returns
// { text, language, duration, segments, backend, model }.
export async function transcribeAudio(filePath, mimeType, { language = '', task = 'transcribe' } = {}) {
  const buf = await readFile(filePath)
  const form = new FormData()
  form.append('audio', new Blob([buf], { type: mimeType || 'audio/mpeg' }), basename(filePath))
  if (language) form.append('language', language)
  form.append('task', task)

  let res
  try {
    res = await fetch(`${WHISPER_URL}/transcribe`, { method: 'POST', body: form })
  } catch (err) {
    throw new Error(`Whisper service unreachable at ${WHISPER_URL} — is it running? (${err.message})`)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Whisper service error ${res.status}`)
  return data
}
