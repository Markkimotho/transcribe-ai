# semaje — Setup Guide

Transcription platform: **local Whisper** does all speech-to-text, a **swappable
LLM** (local Claude Code by default, Gemini fallback) handles the 15 language
tasks over the transcript, and everything lands in a **persistent, searchable
library** with sharing, exports, async jobs for big files, and a realtime
WebSocket for dictation. A browser extension dictates into any text box.

## Architecture

```
                       ┌─ services/whisper (STT, :8011, Python)
web app / extension ─▶ services/api (:3001, HTTP + /ws)
                       ├─ services/realtime (WS windows → whisper)
                       ├─ services/jobs (pg-boss queue + worker)
                       │    └─ storage → whisper → pipeline → llm → transcripts
                       ├─ services/transcripts (Postgres FTS library, shares)
                       ├─ services/auth (single-user | local-db)
                       ├─ services/storage (fs | s3/MinIO)
                       └─ services/llm (claude-local | gemini)
```

Deployment mode is **adapter-driven** — the same codebase runs:

| Mode | AUTH_ADAPTER | STORAGE_ADAPTER | Stack |
|---|---|---|---|
| Single user (default) | `single-user` | `fs` | postgres + whisper + api/worker |
| Small team | `local-db` | `fs` or `s3` | + accounts/login |
| Cloud (Phase 3) | `oidc` | `s3` | + SSO, GPU pool |

## Quick start (Docker, recommended)

```bash
cp .env.example .env       # set GEMINI_API_KEY if using the gemini LLM adapter
npm install && npm run build
docker compose up -d
docker compose exec api npm run migrate
open http://localhost:8080
```

## Local development (no Docker for the app)

Prereqs: Node 18+, Python 3.11+, ffmpeg, and Postgres running with a `semaje`
database (`docker compose up -d postgres` works).

```bash
# 1. Whisper STT service (one-time)
services/whisper/setup.sh

# 2. App deps + DB schema
npm install
npm run migrate

# 3. Everything at once: whisper (:8011) + api (:3001) + web (:5173)
npm run dev

# 4. The job worker (needed for >20MB async uploads), separate terminal:
npm run worker
```

## Browser extension

See `services/extension/README.md` — load unpacked from `services/extension/`,
point it at your server, dictate with `Cmd/Ctrl+Shift+1`.

## LLM adapter

`LLM_ADAPTER=claude-local` (default) shells out to your local Claude Code CLI —
no hosted API. `LLM_ADAPTER=gemini` uses the Gemini API (`GEMINI_API_KEY`).
claude-local becomes the shipped default once `npm run eval:llm` passes all 15
task rubrics for it; until then compose pins gemini.

## Tests & evals

```bash
npm test               # gate tests, all TS services (fast, free, no network)
npm run test:whisper   # Python STT service gate tests
npm run typecheck      # strict TS across services
npm run eval:whisper   # STT accuracy (WER)
npm run eval:llm       # 15 task rubrics × adapter(s)  [EVAL_ADAPTERS=claude-local,gemini]
npm run eval:realtime  # streaming WER vs batch
```

## Project structure

```
packages/schemas/       zod contracts shared by every service
packages/db/            pg pool factory
migrations/             Postgres schema (node-pg-migrate)
services/api/           HTTP gateway (auth, uploads, jobs, transcripts, rate limit)
services/auth/          identity adapters + JWT + API keys + tenancy guard
services/storage/       fs | s3 blob adapters
services/transcripts/   library: CRUD, FTS search, shares, SRT/VTT/TXT/MD exports
services/jobs/          pg-boss queue + transcription worker
services/realtime/      WebSocket streaming STT (/ws)
services/llm/           claude-local | gemini adapters + task evals
services/pipeline/      pure Whisper↔LLM routing
services/whisper/       STT engine (Python, faster-whisper | whisper.cpp)
services/extension/     MV3 browser extension (dictation + library panel)
src/                    React web app (transcribe, library, shares, settings)
```

## Troubleshooting

| Issue | Fix |
|---|---|
| `whisper.reachable: false` in /api/health | Start it: `npm run dev:whisper` (or the compose `whisper` service). |
| Jobs stay `queued` | The worker isn't running: `npm run worker` (or compose `worker`). |
| `claude-local failed to start` | Install Claude Code CLI or set `LLM_ADAPTER=gemini`. |
| 401s in local-db mode | Register at `/login`, or create an API key at `/settings/api-keys`. |
| Extension can't connect | Popup → set Server URL; check CORS_ORIGINS; API key valid? |
| macOS: hangs / vanishing .venv | Project on iCloud Drive — keep it downloaded or move it off iCloud. |
