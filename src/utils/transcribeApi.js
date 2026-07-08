// ── Mode 1: Proxy (recommended for public deployments) ───────
// File is sent to your Express server. Whisper transcribes locally;
// Gemini (server key) handles task post-processing. No key in the browser.
export async function transcribeViaProxy(file, { prompt, task, options, language } = {}) {
  const formData = new FormData()
  formData.append('audio', file)
  if (prompt) formData.append('prompt', prompt)
  if (task) formData.append('task', task)
  if (options) formData.append('options', JSON.stringify(options))
  if (language) formData.append('language', language)

  const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data.transcript
}

// ── Mode 2: Direct (user supplies their own Gemini key) ──────
// Whisper still runs on the server; the user's key is used only for the
// Gemini task step and is never stored.
export async function transcribeDirect(file, { prompt, task, options, language, apiKey } = {}) {
  const formData = new FormData()
  formData.append('audio', file)
  if (prompt) formData.append('prompt', prompt)
  if (task) formData.append('task', task)
  if (options) formData.append('options', JSON.stringify(options))
  if (language) formData.append('language', language)
  formData.append('apiKey', apiKey)

  const res = await fetch('/api/transcribe-direct', { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data.transcript
}
