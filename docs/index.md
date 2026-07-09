# semaje - AI-Powered Audio Transcription Platform


## Overview

**semaje** is a production-ready, full-stack AI transcription platform powered by Google Gemini 2.0 Flash. It delivers intelligent, context-aware transcription across 15+ specialized domains — from medical dictation to legal depositions, live podcast recording to music lyrics extraction.

Unlike simple speech-to-text APIs, semaje processes audio with deep contextual understanding through sophisticated prompt engineering (600+ lines of domain-specific rules), enabling transcription that adapts to professional and creative workflows.

## Key Capabilities

### 15+ Specialized AI Tasks

Professional-grade transcription with purpose-built prompt engineering for each domain:

#### Core Transcription

- **Verbatim Transcription** - Word-for-word transcripts with optional speaker labels & timestamps
- **Subtitles (SRT)** - Professionally timed media subtitles with character limits
- **Captions (WebVTT)** - Standards-compliant accessibility captions

#### Speaker & Audio Analysis

- **Diarization** - Multi-speaker identification with speaking time statistics
- **Speaker Labeling** - Auto-detects roles (Host/Guest, Doctor/Patient, Lawyer/Witness)
- **Live Transcription** - Real-time 5-second chunked processing with silence detection
- **Sentiment Analysis** - Tone detection + emotional timeline per speaker

#### Content Intelligence

- **Summary & Key Points** - Automatic extraction of action items, decisions, takeaways
- **Chapters/Bookmarking** - Auto-segments audio into logical chapters
- **Lyrics Extraction** - Music transcription with instrumental markers
- **Interview/Podcast Format** - Purpose-built formatting with notable quotes

#### Professional Domain Tasks

- **Medical Dictation** - Clinical-grade precision, SOAP format, drug interaction awareness
- **Legal Deposition** - Strict verbatim with line numbers, objections, exhibits, legal markers
- **Meeting Notes** - Structured output (attendees, decisions, action items, follow-ups)
- **Translation** - Transcribe + translate with side-by-side mode & auto language detection
- **Multilingual Support** - Code-switching detection with per-segment language labeling

### Smart Audio Intelligence

Baked into every task — intelligent quality handling that goes beyond basic speech-to-text:

- **Intelligent Quality Handling** - Auto-detects poor audio, background noise, phone calls, echo
- **Inaudible Markers** - Uses `[word?]` and `[inaudible - ~3s]` instead of hallucinating
- **Acronym & Number Handling** - Spell-out rules (1-10), currency/percentage auto-formatting
- **Accent Preservation** - Transcribes accents as-spoken, not auto-corrected
- **Context-Aware Formatting** - Domain-specific punctuation, capitalization, paragraph breaks

### Real-Time Live Transcription

Sophisticated real-time transcription pipeline using browser's MediaRecorder API:

- **5-second Audio Chunks** - Recorded via MediaRecorder API
- **Async Queue Management** - Backpressure handling to prevent memory overload
- **Silence Auto-filtering** - Drops silence segments, keeps meaningful results
- **Exponential Backoff** - Graceful degradation on API rate limits
- **Per-chunk Timestamps** - Real-time segment display
- **Browser-Native** - Chrome, Firefox, Edge compatible — no plugins

### Advanced Features

- **6 Audio Formats** - Support for multiple audio input formats
- **2 API Modes** - File upload and live streaming
- **600+ Lines of Prompts** - Domain-specific constraint engineering
- **Production-Ready** - Docker containerized, scalable architecture

## Technology Stack

| Layer               | Technology                           |
| ------------------- | ------------------------------------ |
| **Frontend**        | React 18 with Vite                   |
| **UI Framework**    | Tailwind CSS                         |
| **Icons**           | Lucide Icons                         |
| **Backend**         | Node.js with Express                 |
| **AI Engine**       | Google Gemini 2.0 Flash (multimodal) |
| **Audio Recording** | MediaRecorder API                    |
| **Deployment**      | Docker                               |
| **Output Formats**  | SRT, WebVTT, JSON, Markdown          |

## AI & Prompt Engineering

### Gemini 2.0 Flash Engine

| Aspect            | Details                                |
| ----------------- | -------------------------------------- |
| **Model**         | Google Gemini 2.0 Flash (multimodal)   |
| **Max Output**    | 16,384 tokens per request              |
| **Processing**    | Audio file upload + live streaming     |
| **Rate Limiting** | 3-tier exponential backoff (15/30/45s) |
| **Prompt System** | 600+ lines of domain-specific rules    |

### Prompt Architecture

The core differentiator — `promptBuilder.js` contains 600+ lines of carefully crafted, domain-specific instruction sets that transform Gemini from a generic model into a specialized transcription expert. Each task has its own rules for:

- Professional formatting standards
- Quality handling and validation
- Industry-specific conventions
- Output structure and requirements

## Getting Started

### Prerequisites

- Node.js 16+
- Google Gemini API key
- An audio file or microphone access

### Installation

```bash
git clone https://github.com/Markkimotho/transcribe-ai
cd transcribe-ai

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your GEMINI_API_KEY to .env
```

### Development Server

```bash
npm run dev
```

Access at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

### Docker Deployment

```bash
docker build -t semaje:latest .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=your_key \
  semaje:latest
```

## Usage

### File Upload Transcription

1. Open the app and select "Upload Audio"
2. Choose an audio file (supports multiple formats)
3. Select transcription task
4. Click "Transcribe" and get results in seconds
5. Export as SRT, WebVTT, JSON, or Markdown

### Live Transcription

1. Click "Start Live Recording"
2. Allow microphone access
3. Select task and speak
4. See real-time transcription appear as you speak
5. Stop recording and export results

### Domain-Specific Tasks

Select your use case:

- **Medical Dictation** - For clinical transcription
- **Legal Deposition** - For courtroom recordings
- **Podcast/Interview** - For content formatting
- **Meeting Notes** - For business recordings
- **Translation** - For multilingual content
- **Music** - For lyrics and instrumental detection

## API Documentation

### Upload Endpoint

```bash
POST /api/transcribe
Content-Type: multipart/form-data

{
  "audio": <file>,
  "task": "medical_dictation",
  "language": "en"
}
```

### Response

```json
{
  "transcription": "...",
  "task": "medical_dictation",
  "processingTime": 2.5,
  "confidence": 0.95,
  "metadata": {
    "duration": 120,
    "language": "en"
  }
}
```

## Performance

- **Average Processing Time** - 2-5 seconds per minute of audio
- **Real-time Latency** - <500ms per 5-second chunk
- **Accuracy** - 95%+ with professional audio
- **Concurrent Processing** - Queue-based management handles backpressure

## Architecture Highlights

- **Modular Design** - Pluggable tasks and prompt systems
- **Efficient Queue Management** - Async processing with backpressure handling
- **Intelligent Fallbacks** - Graceful degradation on API limits
- **Browser Native** - No external plugins or dependencies for recording
- **Containerized** - Docker-ready for cloud deployment
- **Scalable** - Designed for production workloads

## Advanced Features

### Code-Switching Detection

Multilingual support with frame-by-frame language labeling — preserves exact speech without mid-sentence translation.

### Contextual Formatting

Each task applies domain-specific rules:

- Medical: Clinical abbreviations, drug names, vital sign formatting
- Legal: Line numbering, objection markers, exhibit references
- Podcast: Notable quotes extraction, chapter breaks, intro/outro detection

### Quality Indicators

Built-in quality metrics:

- Audio clarity assessment
- Noise floor detection
- Speaker overlap statistics
- Confidence scoring per segment

## Use Cases

- 📋 **Legal Firms** - Deposition transcription with courtroom formatting
- 🏥 **Healthcare** - Clinical dictation with SOAP-format output
- 🎙️ **Content Creators** - Podcast cleanup and chapter generation
- 🎵 **Musicians** - Lyrics extraction and instrumental detection
- 📊 **Enterprises** - Meeting transcription and note generation
- 🌍 **Localization** - Multilingual content with code-switching

## Repository

[View on GitHub](https://github.com/Markkimotho/transcribe-ai)

## Status

**Production Ready** - March 2026

All core features tested and optimized for production use. Continuous improvements to prompt engineering and domain-specific accuracy.

---

**Transform your audio into intelligent insights.** 🎙️✨
