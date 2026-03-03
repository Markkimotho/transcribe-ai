import { useState } from 'react'
import { Info, ChevronDown, ChevronUp, Upload, Sliders, FileText, Download, Mic, KeyRound } from 'lucide-react'

const steps = [
  {
    icon: Upload,
    title: 'Upload your audio',
    description: 'Drag & drop an audio file onto the drop zone, or click to browse your files. Supported formats: MP3, WAV, M4A, OGG, FLAC, and MP4 (up to 25MB).',
  },
  {
    icon: Sliders,
    title: 'Choose your options',
    description: 'Toggle Speaker Labels to identify different speakers in the audio. Enable Timestamps to add time markers at each paragraph or speaker turn.',
  },
  {
    icon: Mic,
    title: 'AI transcription',
    description: 'Claude AI processes your audio and generates an accurate transcript. This typically takes 10–30 seconds depending on file length.',
  },
  {
    icon: FileText,
    title: 'Review your transcript',
    description: 'The transcript appears below with speaker labels and timestamps (if selected). Use the Copy button or download as a .txt file.',
  },
]

export default function Instructions() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-xs font-display font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <Info size={13} />
          How to use
        </span>
        {open ? <ChevronUp size={14} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--muted)' }} />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {steps.map(({ icon: Icon, title, description }, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(232,255,71,0.08)', border: '1px solid var(--border)' }}>
                  <Icon size={14} style={{ color: '#e8ff47' }} />
                </div>
                <div>
                  <p className="text-xs font-display font-bold mb-0.5">
                    <span className="font-mono" style={{ color: '#e8ff47' }}>{i + 1}.</span> {title}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t flex items-start gap-2" style={{ borderColor: 'var(--border)' }}>
            <KeyRound size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted)' }} />
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              <strong>Tip:</strong> In <em>Server mode</em>, your API key is kept securely on the backend. In <em>Direct mode</em>, you provide your own Anthropic key — it's stored locally and never sent to third-party servers.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
