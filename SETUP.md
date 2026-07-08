# Voxail — Setup Guide

Audio transcription powered by **Whisper** (local speech-to-text) with **Gemini**
handling the language tasks (summary, sentiment, chapters, translation, meeting/
medical/legal formatting, etc.) over the Whisper transcript.

- **Whisper** does all speech-to-text. Two interchangeable backends:
  `faster-whisper` (default, pure Python) or `whisper.cpp` (Metal on Apple Silicon).
- **Gemini** never sees audio. It only post-processes the Whisper transcript for
  the task features. Plain transcription and live transcription never call Gemini.

---

## Architecture

```
audio ─▶ Node/Express (server/) ─▶ Whisper STT service (services/whisper, :8011)
                     │                         └─ faster-whisper | whisper.cpp
                     ▼
             task == transcription? ── yes ─▶ return Whisper transcript
                     │ no
                     ▼
             Gemini over transcript text ─▶ return task output
```

---

## Prerequisites

- **Node.js** 18+ — [nodejs.org](https://nodejs.org)
- **Python** 3.11+ (for the Whisper service)
- **ffmpeg** — `brew install ffmpeg` (audio decoding)
- **Gemini API key** — only needed for the task features. [Get one free](https://aistudio.google.com/apikey). Plain transcription works with no key.
- For the `whisper.cpp` backend: **cmake** — `brew install cmake`

---

## 1. Install the Whisper STT service

```bash
# faster-whisper backend (default). Downloads the model on first run.
services/whisper/setup.sh

# Also build the whisper.cpp backend (optional):
BUILD_WHISPER_CPP=1 services/whisper/setup.sh
```

Pick a model with `WHISPER_MODEL` (default `base`): `tiny` | `base` | `small` |
`medium` | `large-v3`. Bigger = more accurate, slower, larger download.

## 2. Install the Node app

```bash
npm install
```

## 3. Configure environment

```bash
cp .env.example .env
```

Key settings (see `.env.example` for all):

```env
WHISPER_URL=http://localhost:8011   # where the Whisper service listens
WHISPER_BACKEND=faster-whisper      # or whisper.cpp
WHISPER_MODEL=base
GEMINI_API_KEY=your-key-here        # tasks only; omit for transcription-only
VITE_API_MODE=proxy                 # proxy | direct
```

### API Modes

| Mode | How it works | Best for |
|------|-------------|----------|
| **proxy** (default) | Audio → your backend → Whisper (local) + Gemini (server key). | Production / shared |
| **direct** | Whisper still runs on the server; the user's Gemini key is used only for tasks. | Personal use |

---

## 4. Run

```bash
npm run dev
```

Starts all three at once:
- **Whisper STT** → `http://localhost:8011`
- **Express backend** → `http://localhost:3001`
- **Vite frontend** → `http://localhost:5173`

Individually:

```bash
npm run dev:whisper    # Whisper STT service
npm run dev:server     # Express only
npm run dev:frontend   # Vite only
```

---

## 5. Tests & evals

```bash
npm test               # Node pipeline gate tests (routing) — fast, free
npm run test:whisper   # Python service gate tests — fast, free
npm run test:all       # both
npm run eval:whisper   # real Whisper accuracy eval (WER threshold) — slow
```

Switch the eval to the other backend:

```bash
WHISPER_BACKEND=whisper.cpp npm run eval:whisper
```

---

## 6. Build for production

```bash
npm run build
```

The Whisper service runs as its own process — start it alongside the Node server
(`services/whisper/run.sh`) in production.

---

## Project Structure

```
voxail/
├── server/
│   ├── index.js          # Express: pipeline orchestration
│   ├── pipeline.js       # pure Whisper↔Gemini routing (unit-tested)
│   ├── pipeline.test.js  # gate tests
│   ├── whisperClient.js  # calls the Whisper STT service
│   └── gemini.js         # Gemini text-processing (transcript in, task out)
│
├── services/whisper/     # self-contained Whisper STT service
│   ├── app.py            # FastAPI (contract.md)
│   ├── config.py
│   ├── backends/         # faster_whisper + whisper_cpp
│   ├── tests/            # gate tests (fake backend)
│   ├── evals/            # real accuracy eval
│   ├── setup.sh / run.sh
│   └── contract.md
│
└── src/                  # React frontend (unchanged tabs/tasks)
```

---

## Supported Formats

Anything ffmpeg can decode: MP3, WAV, M4A, OGG, FLAC, MP4 — up to 25MB.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Health shows `whisper.reachable: false` | Start the Whisper service: `npm run dev:whisper`. Check `WHISPER_URL`. |
| Task features fail, transcription works | Missing/invalid `GEMINI_API_KEY`. Tasks need Gemini; plain transcription does not. |
| `whisper.cpp binary not found` | Run `BUILD_WHISPER_CPP=1 services/whisper/setup.sh` (needs cmake). |
| First transcription is slow | The Whisper model loads lazily on the first request, then stays warm. |
| Port 8011 in use | Set `WHISPER_PORT` (service) and `WHISPER_URL` (server) to a free port. |
| `require()` hangs / venv vanished on macOS | Project is on iCloud Drive — it evicts files. Keep `node_modules` and `.venv` downloaded (System Settings → Apple Account → iCloud → "Keep Downloaded"), or move the project off iCloud. |
