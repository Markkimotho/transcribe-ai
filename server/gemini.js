// Gemini text-processing helper. Whisper does the listening; Gemini only
// ever sees the resulting transcript text now — never raw audio.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

// Runs the task prompt against the Whisper transcript. Retries on 429.
export async function runGeminiOnText(prompt, transcriptContext, apiKey) {
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: `${prompt}\n\n${'═'.repeat(40)}\n\n${transcriptContext}` }] }],
    generationConfig: { maxOutputTokens: 16384 },
  })

  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload },
    )
    const data = await res.json()

    if (res.status === 429) {
      const wait = (attempt + 1) * 15_000
      console.log(`[Gemini rate limited] Retrying in ${wait / 1000}s (attempt ${attempt + 1}/3)`)
      await new Promise(r => setTimeout(r, wait))
      lastError = data?.error?.message || 'Rate limited'
      continue
    }

    if (!res.ok) throw new Error(data?.error?.message || `Gemini API error ${res.status}`)

    const out = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
    if (!out) throw new Error('No text returned from Gemini')
    return out
  }
  throw new Error(`Gemini rate limited after 3 retries: ${lastError}`)
}
