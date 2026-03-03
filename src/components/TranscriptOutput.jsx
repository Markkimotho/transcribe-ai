import { useState } from 'react'
import { FileText, Copy, Check, Download, Loader2, AlertTriangle } from 'lucide-react'

export default function TranscriptOutput({ transcript, status, error, loading }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-display font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#e8ff47' }}>
          <FileText size={13} />
          Transcript
        </span>
        {transcript && (
          <div className="flex gap-2">
            <button onClick={handleCopy}
              className="text-xs font-mono px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 hover:border-yellow-300/50"
              style={{ borderColor: 'var(--border)', color: copied ? '#4ade80' : 'var(--muted)' }}>
              {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
            <button onClick={handleDownload}
              className="text-xs font-mono px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 hover:border-yellow-300/50"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              <Download size={12} /> .txt
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 min-h-[120px]">
        {loading && (
          <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--muted)' }}>
            <Loader2 size={14} className="animate-spin" style={{ color: '#e8ff47' }} />
            {status}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-xs font-mono" style={{ color: '#f87171' }}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {transcript && (
          <pre className="text-sm whitespace-pre-wrap leading-relaxed font-sans" style={{ color: 'var(--text)' }}>
            {transcript}
          </pre>
        )}
      </div>
    </div>
  )
}
