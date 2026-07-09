# Realtime Service — Contract

WebSocket streaming STT at `/ws` (upgrades on the API's HTTP server).
Auth: `?token=<JWT or smj_ API key>`; single-user mode needs none.

## Protocol (zod: `RTClientMessage` / `RTServerMessage` in @semaje/schemas)

Client → server:
- text `{"type":"start","mode":"dictation"|"meeting","language"?,"mimeType"?,"title"?}`
- binary frames — raw MediaRecorder chunks (webm/ogg/mp4)
- text `{"type":"stop"}`

Server → client:
- `{"type":"ready"}` — send audio now
- `{"type":"final","text","tStart","tEnd","language"?}` — one per ~5s window
- `{"type":"error","error"}` — window failed; stream continues
- `{"type":"end","transcriptId"?}` — session closed; id when persisted

## Semantics

- Windows: ~5s, min 3000 bytes; the first chunk's container header is cached
  and prepended to later windows so ffmpeg can decode them (`WindowBuffer`).
- Windows are processed serially — `final`s always arrive in order with
  cumulative `tStart/tEnd` offsets.
- Persistence: `meeting` mode always saves to the library on stop; `dictation`
  saves only when `title` was provided.
