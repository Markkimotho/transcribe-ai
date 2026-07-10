import { getAccessToken } from './apiClient'

function authHeaders() {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Mode 1: Proxy (recommended for public deployments) ───────
// File is sent to your Express server. Whisper transcribes locally;
// the configured server-side LLM handles task post-processing.
export async function transcribeViaProxy(file, { prompt, task, options, language } = {}) {
  const formData = new FormData()
  formData.append('audio', file)
  if (prompt) formData.append('prompt', prompt)
  if (task) formData.append('task', task)
  if (options) formData.append('options', JSON.stringify(options))
  if (language) formData.append('language', language)

  const res = await fetch('/api/transcribe', { method: 'POST', headers: authHeaders(), body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data
}

// ── Mode 2: Direct (user supplies their own fallback task key) ─
// Whisper still runs on the server; the user's key is used only for the
// formatting task step and is never stored.
export async function transcribeDirect(file, { prompt, task, options, language, apiKey } = {}) {
  const formData = new FormData()
  formData.append('audio', file)
  if (prompt) formData.append('prompt', prompt)
  if (task) formData.append('task', task)
  if (options) formData.append('options', JSON.stringify(options))
  if (language) formData.append('language', language)
  formData.append('apiKey', apiKey)

  const res = await fetch('/api/transcribe-direct', { method: 'POST', headers: authHeaders(), body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data
}
