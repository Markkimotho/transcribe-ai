# semaje — Setup Guide

Transcription platform: **local Whisper** does all speech-to-text, a **swappable
LLM** (local Ollama by default, Gemini optional) handles the 15 language
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
cp .env.example .env
deploy/semaje cpu up
open http://localhost:8080
```

The deploy command builds the web app in Docker, migrates Postgres, starts the
worker, and persists blobs, models, exports, and logs. No hosted API key is
needed.

### Hardware profiles

| Profile | Recommended hardware | Defaults | Command |
|---|---|---|---|
| `cpu` | 4 cores, 8 GB RAM, 10 GB disk | Whisper `base` int8, one worker | `deploy/semaje cpu up` |
| `workstation-gpu` | NVIDIA 8+ GB VRAM, 16 GB RAM | Whisper `medium` fp16, two jobs | `deploy/semaje workstation-gpu up` |
| `server-gpu` | NVIDIA 16+ GB VRAM, 32 GB RAM | Whisper `large-v3` fp16, two workers | `deploy/semaje server-gpu up` |

GPU profiles require the NVIDIA driver and NVIDIA Container Toolkit. Override
`WHISPER_MODEL`, `WORKER_CONCURRENCY`, and `WORKER_REPLICAS` in `.env` to fit
your machine. Use `deploy/semaje <profile> status|logs|down` for operations.

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

`LLM_ADAPTER=ollama` (default) calls the Ollama service on your own machine.
`LLM_ADAPTER=claude-local` shells out to a locally installed Claude Code CLI.
`LLM_ADAPTER=gemini` is an opt-in cloud adapter and requires `GEMINI_API_KEY`.

## Upgrades

1. Back up Postgres and the `blobdata` volume.
2. Pull the new source or image tag.
3. Run `deploy/semaje <profile> up`; the one-shot migration service finishes
   before API and workers are replaced.
4. Check `deploy/semaje <profile> status` and `/api/health`.

Database migrations are forward-only. Restore the backup before downgrading to
an older release.

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
