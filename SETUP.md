# Voxail — Setup Guide

AI-powered audio transcription using Gemini. Upload an audio file and get an accurate transcript with optional speaker labels and timestamps.

---

## Prerequisites

- **Node.js** 18+ — [Download here](https://nodejs.org)
- **npm** (comes with Node.js)
- **Gemini API key** — [Get a free one here](https://aistudio.google.com/apikey)

---

## 1. Install dependencies

```bash
cd voxail
npm install
```

---

## 2. Configure environment

Copy the example env file and add your API key:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# Your Gemini API key
GEMINI_API_KEY=your-gemini-api-key-here

# Port for the Express backend
PORT=3001

# API mode: "proxy" (recommended) or "direct"
VITE_API_MODE=proxy
```

### API Modes

| Mode | How it works | Best for |
|------|-------------|----------|
| **proxy** (default) | Audio goes to your Express backend, which calls Gemini. Your API key stays secret on the server. | Production / shared deployments |
| **direct** | Users enter their own Gemini API key in the browser. No backend needed. | Personal use / static hosting |

---

## 3. Run the dev server

```bash
npm run dev
```

This starts both servers simultaneously:
- **Vite** (frontend) → `http://localhost:5173`
- **Express** (backend) → `http://localhost:3001`

Open `http://localhost:5173` in your browser.

### Run individually

```bash
npm run dev:frontend   # Vite only (port 5173)
npm run dev:server     # Express only (port 3001)
```

---

## 4. Build for production

```bash
npm run build
```

This generates a `dist/` folder with optimized static files.

---

## 5. Deployment

### Option A: Railway (recommended)

Deploys both frontend + backend together. Best for proxy mode.

1. Push your project to GitHub
2. Connect the repo on [railway.app](https://railway.app)
3. Set `GEMINI_API_KEY` as an environment variable
4. Deploy

### Option B: Vercel + Render

- Deploy `dist/` (frontend) to [Vercel](https://vercel.com)
- Deploy `server/` (backend) to [Render](https://render.com)
- Update CORS origins in `server/index.js` to your Vercel URL

### Option C: Static hosting (Direct mode only)

Set `VITE_API_MODE=direct`, build, and deploy `dist/` to any static host:
- [Netlify](https://netlify.com)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [GitHub Pages](https://pages.github.com)

Users will need to provide their own Gemini API key.

### Option D: Docker

```bash
docker build -t voxail .
docker run -p 3001:3001 -e GEMINI_API_KEY=AIza... voxail
```

---

## Project Structure

```
voxail/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .env.example
├── .gitignore
│
├── server/
│   └── index.js           # Express proxy backend
│
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    │
    ├── context/
    │   └── AppContext.jsx   # Global state: theme, API mode, key
    │
    ├── hooks/
    │   └── useTranscribe.js # Transcription logic
    │
    ├── utils/
    │   └── transcribeApi.js # Proxy vs direct API calls
    │
    └── components/
        ├── Header.jsx
        ├── ApiKeySetup.jsx
        ├── Instructions.jsx
        ├── DropZone.jsx
        ├── OptionsBar.jsx
        ├── TranscriptOutput.jsx
        └── Footer.jsx
```

---

## Supported Formats

MP3, WAV, M4A, OGG, FLAC, MP4 — up to 25MB per file.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Credit balance too low" | The free tier has rate limits — wait a minute and retry, or check [aistudio.google.com](https://aistudio.google.com) |
| "GEMINI_API_KEY not set" | Make sure `.env` exists with your key and restart the server |
| Port already in use | Kill the process: `lsof -ti:3001 \| xargs kill -9` |
| CORS errors in production | Update the `cors({ origin: [...] })` in `server/index.js` with your frontend URL |
