# Jobs Service — Contract

Async transcription on pg-boss (Postgres-backed queue; no Redis for self-host).

## Lifecycle

`queued → running → succeeded | failed | canceled`; `failed → queued` (manual
retry). `succeeded`/`canceled` are terminal. Enforced by `assertTransition`.

## API

```ts
enqueueTranscribeJob(principal, JobInput, webhookUrl?) -> job row   // + queue send
getJob(principal, id) -> job | null                                 // org-scoped
markJob(id, from, to, patch) -> row | null   // compare-and-set on status
processJob(jobId)   // worker: storage → whisper → pipeline → llm? → transcripts
startWorker()       // consumes QUEUE_TRANSCRIBE (npm run worker)
```

## Webhook (fires on terminal states when `webhook_url` set)

```json
{ "event": "job.succeeded", "jobId": "…", "status": "succeeded",
  "transcriptId": "…", "error": null, "ts": "ISO-8601" }
```

Phase 2 adds HMAC signing + retries. Progress: 0→20 (blob) →70 (whisper)
→90 (llm) →100.
