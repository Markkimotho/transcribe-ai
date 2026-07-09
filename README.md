# semaje

Transcription platform for every context — upload, live mic, meetings, and
dictation into any text box via the browser extension. Local-first: **Whisper**
runs on your machine for all speech-to-text, the language tasks run through
**local Claude Code** by default (Gemini optional), and every transcript lands
in a **searchable, shareable library** you own.

## What it does

- **Transcribe anything** — 15 task types: verbatim transcription, subtitles
  (SRT), captions (VTT), summary, sentiment, chapters, translation,
  multilingual, speaker ID, interview, meeting notes, medical, legal, lyrics,
  voicemail.
- **Library** — every transcript persisted, full-text searchable, exportable
  (SRT/VTT/TXT/MD), shareable via public links.
- **Big files** — async job pipeline (upload → queue → worker → library); no
  25MB ceiling.
- **Realtime** — WebSocket streaming STT for live mic and dictation.
- **Browser extension** — Grammarly-style voice dictation into any text box on
  any site, plus your library in a side panel. (`services/extension/`)
- **Three deploy modes, one codebase** — single-user self-host (default,
  zero login), small-team self-host (accounts), cloud multi-tenant (Phase 3),
  switched by auth/storage adapters.

## Quick start

```bash
cp .env.example .env
npm install && npm run build
docker compose up -d
docker compose exec api npm run migrate
open http://localhost:8080
```

Dev mode and full docs: [SETUP.md](SETUP.md). Extension:
[services/extension/README.md](services/extension/README.md).

## Architecture

Services-first monorepo — each concern is a self-contained service with its own
contract, tests, and evals:

| Service | Role |
|---|---|
| `services/whisper` | STT engine (Python; faster-whisper / whisper.cpp) |
| `services/api` | HTTP gateway: auth, uploads, jobs, transcripts, rate limits |
| `services/realtime` | WebSocket streaming STT (`/ws`) |
| `services/jobs` | pg-boss queue + transcription worker |
| `services/transcripts` | Postgres FTS library, shares, exports |
| `services/auth` | single-user / local-db adapters, JWT, API keys |
| `services/storage` | fs / s3 (MinIO) blob adapters |
| `services/llm` | claude-local / gemini adapters |
| `services/pipeline` | pure Whisper↔LLM routing |
| `services/extension` | MV3 browser extension |

## Tests

```bash
npm test               # gate tests (all services, no network)
npm run test:whisper   # Python STT gate tests
npm run eval:llm       # LLM task-quality evals
npm run eval:whisper   # STT accuracy (WER)
```
