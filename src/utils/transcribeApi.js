// ── Mode 1: Proxy (recommended for public deployments) ───────
// File is sent to your Express server, which calls Anthropic.
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
// Calls Anthropic directly from the browser using the user's key.
export async function transcribeDirect(file, prompt, apiKey) {
  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'audio/mpeg'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'document', source: { type: 'base64', media_type: mimeType, data: base64 } }
        ]
      }]
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`)
  return data.content.map(b => b.text || '').join('').trim()
}

// ── Helpers ───────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
