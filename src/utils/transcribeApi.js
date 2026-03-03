// ── Mode 1: Proxy (recommended for public deployments) ───────
// File is sent to your Express server, which calls Gemini.
// Your API key is never exposed to the browser.
export async function transcribeViaProxy(file, prompt) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('prompt', prompt)

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data.transcript
}

// ── Mode 2: Direct (user supplies their own key) ──────────────
// Routes through the Express server to bypass CORS, but uses
// the user's own API key — never stored server-side.
export async function transcribeDirect(file, prompt, apiKey) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('prompt', prompt)
  formData.append('apiKey', apiKey)

  const res = await fetch('/api/transcribe-direct', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
  return data.transcript
}
