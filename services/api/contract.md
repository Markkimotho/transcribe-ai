# API Gateway — Contract

Base: `http://<host>:3001`. Auth: `Authorization: Bearer <JWT|smj_ API key>`.
`AUTH_ADAPTER=single-user` → all endpoints work credential-free.
Rate limit: 120 req/min per org (429). Validation: zod (400 with `details`).

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | /api/health | – | service + whisper + llm status |
| POST | /api/auth/register | – | {email, password, displayName?} → tokens (local-db) |
| POST | /api/auth/token | – | {email, password} → {accessToken, refreshToken} |
| POST | /api/auth/refresh | – | {refreshToken} → {accessToken} |
| GET | /api/me | ✓ | → {principal} |
| POST | /api/uploads | ✓ | multipart `audio` → {audioBlob} (≤UPLOAD_MAX_MB, default 500) |
| POST | /api/uploads/presign | ✓ | {filename, mimeType} → {presigned, audioBlobId} \| {presigned:null, fallback} |
| POST | /api/jobs | ✓ | CreateJobRequest → 202 {job}; poll status |
| GET | /api/jobs/:id | ✓ | → {job} (org-scoped) |
| POST | /api/transcripts | ✓ | CreateTranscriptRequest → 201 {transcript} |
| GET | /api/transcripts?q=&limit=&offset= | ✓ | FTS search / list |
| GET | /api/transcripts/:id | ✓ | → {transcript} |
| DELETE | /api/transcripts/:id | ✓ | → {deleted} |
| GET | /api/transcripts/:id/export/:format | ✓ | srt\|vtt\|txt\|md download |
| POST | /api/transcripts/:id/shares | ✓ | CreateShareRequest → 201 {share.token} |
| GET | /api/share/:token | – | public share resolution |
| POST | /api/api-keys | ✓ | {name, scopes?} → {apiKey, token} (token shown once) |
| GET | /api/api-keys | ✓ | list (no secrets) |
| DELETE | /api/api-keys/:id | ✓ | revoke |
| POST | /api/transcribe | ✓ | legacy sync path (small files; no persistence) |
| POST | /api/transcribe-direct | ✓ | same, with user-supplied Gemini key |
| WS | /ws?token= | ✓ | realtime STT — services/realtime/contract.md |

Errors: `{error}` with 400/401/403/404/429/500. Tenancy: every read/write is
org-scoped via the authenticated principal — cross-org rows 404.
