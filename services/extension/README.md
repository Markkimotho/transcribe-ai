# semaje browser extension (MV3)

Voice dictation into any text box on any site + your transcript library in a
side panel. Vanilla JS — loads unpacked with no build step.

## Install (dev)

1. Run the semaje stack (`npm run dev` at the repo root, or `docker compose up`).
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked**
   → select `services/extension/`.
3. Click the semaje toolbar icon → set the Server URL (default
   `http://localhost:3001`). In single-user mode leave the API key empty;
   otherwise create one at `/settings/api-keys` and paste it.

## Use

- **Dictation**: focus any text field → a 🎙 button appears (or press
  `Cmd/Ctrl+Shift+1`) → speak → final text is inserted at your caret.
- **Library**: popup → "Open library panel" → browse/search/copy transcripts.

## Architecture

```
content/cursor-insert.js    caret insertion (pure DOM, jsdom-tested)
content/dictation-widget.js floating mic (Shadow DOM), relays via runtime msgs
background/service-worker.js event hub between content ↔ offscreen
offscreen/audio.js          mic + MediaRecorder + WebSocket to /ws (MV3 needs
                            an offscreen document for getUserMedia)
sidepanel/panel.*           library UI on GET /api/transcripts
popup/popup.*               server URL + API key config
```

Auth: the API key (`smj_…`) doubles as the WS token (`/ws?token=`). Phase 2
adds tab-audio meeting capture; Phase 3 adds the native host for system-wide
dictation.
