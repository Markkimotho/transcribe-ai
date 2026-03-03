// ── Mode 1: Proxy (recommended for public deployments) ───────
// File is sent to your Express server, which calls Anthropic.
// Your API key is never exposed to the browser.
export async function transcribeViaProxy(file, options) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('speakerLabels', String(options.speakerLabels))
  formData.append('timestamps', String(options.timestamps))

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
// ⚠ The key is visible in browser network requests — make sure
//   users understand they are using their own key & quota.
export async function transcribeDirect(file, options, apiKey) {
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
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(options.speakerLabels, options.timestamps) },
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

function buildPrompt(speakers, timestamps) {
  return `
You are an expert transcription engine. Your job is to produce a highly accurate,
clean, and well-formatted transcript of the provided audio. Follow every instruction below precisely.

════════════════════════════════════════
CORE TRANSCRIPTION RULES
════════════════════════════════════════

1. ACCURACY
   - Transcribe every spoken word verbatim. Do not paraphrase, summarize, or omit content.
   - Preserve false starts, repeated words, and self-corrections
     (e.g. "I was— I think I was going to say...").
   - Retain filler words naturally (uh, um, like, you know) unless the audio is clearly
     a polished/scripted production, in which case omit them for readability.

2. PUNCTUATION & FORMATTING
   - Add proper punctuation (periods, commas, question marks, exclamation points).
   - Capitalize the first word of each sentence and all proper nouns.
   - Use paragraph breaks between distinct topics or long pauses (3+ seconds).
   - Format lists as natural prose unless the speaker explicitly enumerates items.

3. NUMBERS & SPECIAL CONTENT
   - Spell out numbers one through ten; use numerals for 11 and above.
   - Spell out ordinals (first, second, twenty-third).
   - Transcribe currency, percentages, and measurements with their symbols
     (e.g. $50, 30%, 5km).
   - Preserve acronyms in uppercase (NASA, AI, FBI).
   - Transcribe URLs, email addresses, and phone numbers exactly as spoken.

4. UNCLEAR / INAUDIBLE AUDIO
   - If a word or phrase is unclear but you can make a reasonable guess, write it
     followed by [?] — e.g. "We met at the [conference?] last year."
   - If audio is fully inaudible for a section, write [inaudible] in its place.
   - If there is significant background noise affecting comprehension, note it once
     at the start: [Note: background noise throughout].
   - Never guess or fabricate content — accuracy over completeness.

5. NON-SPEECH SOUNDS (include only when meaningful)
   - [laughter], [applause], [crosstalk], [music], [silence], [coughing]
   - Do NOT annotate every breath, background noise, or minor sound.

6. LANGUAGE & ACCENTS
   - Transcribe in whatever language is spoken. If multiple languages appear,
     transcribe each in its original language.
   - Do not translate or standardize accents — transcribe what is actually said.
   - If code-switching occurs (speaker mixes languages), reflect it faithfully.

════════════════════════════════════════
CONDITIONAL OPTIONS
════════════════════════════════════════

${speakers ? `
SPEAKER LABELS (enabled)
   - Identify distinct speakers and label them consistently: Speaker 1:, Speaker 2:, etc.
   - Change the label every time the speaker changes, even mid-sentence if needed.
   - If only one speaker is present throughout, do not add labels.
   - For interviews or podcasts, if speaker roles are implied (host/guest), use those
     labels instead: Host:, Guest:, Interviewer:, Respondent:.
   - For phone calls with one side audible, label the audible side as Speaker 1:
     and mark the other as [other party — inaudible].
   - Place the label on a new line before each turn:
     Speaker 1: This is what I said.
     Speaker 2: And this is my reply.
` : 'SPEAKER LABELS: disabled — do not add any speaker labels.'}

${timestamps ? `
TIMESTAMPS (enabled)
   - Insert a timestamp at the start of each speaker turn or paragraph.
   - Format: [MM:SS] for audio under one hour, [HH:MM:SS] for longer audio.
   - Place timestamps at the beginning of the line, before the speaker label if present:
     [00:32] Speaker 1: This is what was said.
   - Add extra timestamps mid-paragraph if a section is longer than ~45 seconds.
   - Timestamps must be approximate but consistent — never go backwards.
` : 'TIMESTAMPS: disabled — do not add any timestamps.'}

════════════════════════════════════════
AUDIO TYPE HANDLING
════════════════════════════════════════

Automatically detect the type of audio and adapt accordingly:

- INTERVIEW / PODCAST: Preserve natural conversation flow; include crosstalk notes.
- LECTURE / MONOLOGUE: Use paragraph breaks every 5–8 sentences for readability.
- MEETING / MULTI-SPEAKER: Be especially careful to correctly attribute each speaker.
- PHONE / LOW QUALITY: Note audio quality once; do your best with unclear segments.
- SCRIPTED / BROADCAST: Omit filler words; clean, publication-ready formatting.
- VOICEMAIL / SHORT CLIP: Transcribe fully; include any identifying info spoken.
- MUSIC WITH VOCALS: Transcribe lyrics if intelligible; note [music] for instrumentals.
- MEDICAL / LEGAL / TECHNICAL: Preserve all terminology exactly as spoken; do not
  simplify or paraphrase domain-specific language.

════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════

- Return ONLY the transcript. No preamble, no explanation, no markdown formatting.
- Do not include headers like "Transcript:" or "Here is the transcription:".
- Do not wrap the output in code blocks or quotes.
- If the audio contains no speech whatsoever, return exactly: [No speech detected]
`.trim()
}
