import { useState } from 'react'
import { Mic, Square, Copy, Check, Download, Trash2, Loader2, AlertTriangle } from 'lucide-react'

export default function LiveTranscription({ liveTranscribe, isBlocked }) {
  const { isRecording, isProcessing, segments, error, startRecording, stopRecording, clearSegments } = liveTranscribe
  const [copied, setCopied] = useState(false)
  const [localError, setLocalError] = useState('')

  const fullText = segments.filter(s => s.status === 'done').map(s => s.text).join('\n\n')

  const handleStart = () => {
    if (isBlocked) {
      setLocalError('Please enter your Gemini API key above before recording.')
      return
    }
    setLocalError('')
    startRecording()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([fullText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `live-transcript-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const displayError = error || localError

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-display font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}>
          <Mic size={13} />
          Live Recording
        </span>
        <div className="flex gap-2">
          {isRecording && (
            <button
              onClick={stopRecording}
              className="text-xs font-mono px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 hover:border-red-400/50"
              style={{ borderColor: 'var(--border)', color: '#f87171' }}
            >
              <Square size={12} fill="#f87171" /> Stop
            </button>
          )}
          {segments.length > 0 && (
            <>
              <button
                onClick={handleCopy}
                className="text-xs font-mono px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 hover:border-yellow-300/50"
                style={{ borderColor: 'var(--border)', color: copied ? '#4ade80' : 'var(--muted)' }}
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
              <button
                onClick={handleDownload}
                className="text-xs font-mono px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 hover:border-yellow-300/50"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                <Download size={12} /> .txt
              </button>
              <button
                onClick={clearSegments}
                className="text-xs font-mono px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 hover:border-red-400/30"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                <Trash2 size={12} /> Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Recording status bar */}
      {isRecording && (
        <div className="flex items-center gap-3 px-5 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(248,113,113,0.04)' }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>Recording…</span>
          {isProcessing && (
            <span className="flex items-center gap-1.5 text-xs font-mono ml-auto" style={{ color: 'var(--muted)' }}>
              <Loader2 size={11} className="animate-spin" style={{ color: 'var(--accent)' }} />
              Processing chunk…
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {displayError && (
        <div className="flex items-start gap-2 px-5 py-3 text-xs font-mono border-b" style={{ color: '#f87171', borderColor: 'var(--border)' }}>
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          {displayError}
        </div>
      )}

      {/* Mic button — idle state */}
      {!isRecording && segments.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-12">
          <button
            onClick={handleStart}
            disabled={isRecording}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(var(--accent-rgb),0.06)',
              border: '2px solid rgba(var(--accent-rgb),0.2)',
            }}
            title="Start recording"
          >
            <Mic size={32} style={{ color: 'var(--accent)' }} />
          </button>
          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            Click to start recording
          </p>
        </div>
      )}

      {/* Listening placeholder — recording but no segments yet */}
      {isRecording && segments.length === 0 && (
        <div className="px-5 py-8 text-center text-xs font-mono" style={{ color: 'var(--muted)' }}>
          Listening… speak now
        </div>
      )}

      {/* Segments list */}
      {segments.length > 0 && (
        <div className="px-5 py-4 flex flex-col gap-3">
          {segments.map((seg, i) => (
            <div key={seg.id}>
              {i > 0 && <div className="border-t mb-3" style={{ borderColor: 'var(--border)', opacity: 0.3 }} />}
              <div className="flex gap-3 items-start">
                <span
                  className="text-[10px] font-mono flex-shrink-0 pt-0.5"
                  style={{ color: 'var(--muted)' }}
                >
                  {seg.timestamp}
                </span>
                {seg.status === 'processing' && (
                  <span className="flex items-center gap-1.5 text-xs font-mono italic" style={{ color: 'var(--muted)' }}>
                    <Loader2 size={11} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    transcribing…
                  </span>
                )}
                {seg.status === 'error' && (
                  <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: '#f87171' }}>
                    <AlertTriangle size={11} />
                    {seg.text}
                  </span>
                )}
                {seg.status === 'done' && (
                  <span className="text-sm font-sans leading-relaxed" style={{ color: 'var(--text)' }}>
                    {seg.text}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Restart button when stopped */}
          {!isRecording && (
            <div className="pt-3 flex justify-center border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono border transition-all hover:border-yellow-300/50"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                <Mic size={12} /> Record again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
