import { useState, useRef } from 'react'
import { Mic, Upload, FileAudio } from 'lucide-react'

export default function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    onFile(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-all select-none ${dragging ? 'drag-active' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-yellow-300/50'}`}
      style={{ borderColor: dragging ? 'var(--accent)' : 'var(--border)', background: 'var(--surface)' }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={e => handleFile(e.target.files[0])}
      />
      <div className="flex justify-center mb-4">
        {fileName ? (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
            <FileAudio size={24} style={{ color: 'var(--accent)' }} />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid var(--border)' }}>
            <Mic size={24} style={{ color: 'var(--muted)' }} />
          </div>
        )}
      </div>
      <p className="font-display font-bold text-base mb-1">
        {fileName || 'Drop your audio file here'}
      </p>
      <p className="text-xs font-mono mb-3" style={{ color: 'var(--muted)' }}>
        MP3 · WAV · M4A · OGG · FLAC · MP4 — up to 25MB
      </p>
      {!fileName && (
        <div className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-md border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <Upload size={12} /> or click to browse
        </div>
      )}
    </div>
  )
}
