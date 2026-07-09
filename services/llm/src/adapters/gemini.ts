// gemini adapter — HTTP fallback engine (lifted from server/gemini.js).
// Retries on 429. Active until claude-local clears the eval bar.
import { assemblePrompt, type LlmAdapter } from '../index.ts'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export class GeminiAdapter implements LlmAdapter {
  readonly name = 'gemini'

  constructor(private apiKey = process.env.GEMINI_API_KEY || '') {}

  async run(taskPrompt: string, transcriptContext: string): Promise<string> {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY not configured for the gemini adapter')

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: assemblePrompt(taskPrompt, transcriptContext) }] }],
      generationConfig: { maxOutputTokens: 16384 },
    })

    let lastError = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload },
      )
      const data: any = await res.json()

      if (res.status === 429) {
        const wait = (attempt + 1) * 15_000
        console.log(`[gemini rate limited] retrying in ${wait / 1000}s (attempt ${attempt + 1}/3)`)
        await new Promise(r => setTimeout(r, wait))
        lastError = data?.error?.message || 'Rate limited'
        continue
      }
      if (!res.ok) throw new Error(data?.error?.message || `Gemini API error ${res.status}`)

      const out = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim()
      if (!out) throw new Error('No text returned from Gemini')
      return out
    }
    throw new Error(`Gemini rate limited after 3 retries: ${lastError}`)
  }
}
