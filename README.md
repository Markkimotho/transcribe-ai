# TranscribeAI

AI-powered audio transcription built with React, Vite, and Claude. Upload an audio file and get an accurate, well-formatted transcript with optional speaker labels and timestamps.

![TranscribeAI](https://img.shields.io/badge/Powered%20by-Claude%20AI-e8ff47?style=flat-square) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)

## Features

- **Drag & drop upload** — MP3, WAV, M4A, OGG, FLAC, MP4 (up to 25MB)
- **Speaker labels** — auto-detects speakers with contextual labels (Host/Guest, Interviewer/Respondent)
- **Timestamps** — `[MM:SS]` or `[HH:MM:SS]` at each turn or paragraph
- **Smart formatting** — handles numbers, acronyms, currencies, URLs, and multi-language audio
- **Inaudible markers** — `[inaudible]` and `[word?]` instead of hallucinated guesses
- **Audio type detection** — adapts output for podcasts, meetings, lectures, voicemails, and more
- **Two API modes** — switchable from the UI:
  - **Server mode** — API key stays hidden on your Express backend
  - **Direct mode** — users bring their own Anthropic key (no backend needed)
- **Dark/light theme** — toggle from the header
- **Copy & download** — one-click copy or download transcript as `.txt`

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and add your Anthropic API key
cp .env.example .env

# Start dev server (frontend + backend)
npm run dev
```

Open **http://localhost:5173**

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | — |
| `PORT` | Express server port | `3001` |
| `VITE_API_MODE` | `proxy` (backend) or `direct` (user key) | `direct` |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite + Express concurrently |
| `npm run dev:frontend` | Vite only (port 5173) |
| `npm run dev:server` | Express only (port 3001) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm start` | Start Express in production |

## Project Structure

```
transcribe-ai/
├── server/
│   └── index.js              # Express proxy + Anthropic SDK
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── context/
│   │   └── AppContext.jsx     # Theme, API mode, key state
│   ├── hooks/
│   │   └── useTranscribe.js   # Transcription logic
│   ├── utils/
│   │   └── transcribeApi.js   # Proxy & direct API calls
│   └── components/
│       ├── Header.jsx
│       ├── ApiKeySetup.jsx
│       ├── Instructions.jsx
│       ├── DropZone.jsx
│       ├── OptionsBar.jsx
│       ├── TranscriptOutput.jsx
│       └── Footer.jsx
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Deployment

| Platform | Setup |
|---|---|
| **Railway** | Push to GitHub → connect repo → set `ANTHROPIC_API_KEY` env var → deploy |
| **Vercel + Render** | Frontend on Vercel, backend on Render. Update CORS origins. |
| **Static (direct mode)** | `npm run build` → deploy `dist/` to Netlify/Cloudflare/GitHub Pages |
| **Docker** | `docker build -t transcribe-ai . && docker run -p 3001:3001 -e ANTHROPIC_API_KEY=... transcribe-ai` |

See [SETUP.md](SETUP.md) for detailed instructions.

## Tech Stack

- **Frontend** — React 18, Vite, Tailwind CSS, Lucide React
- **Backend** — Express, Multer, Anthropic SDK
- **AI** — Claude (claude-sonnet-4-20250514)

## License

MIT
