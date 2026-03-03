import { useContext, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { KeyRound, ExternalLink, Save, CheckCircle, Trash2 } from 'lucide-react'

export default function ApiKeySetup() {
  const { apiKey, setApiKey } = useContext(AppContext)
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(!apiKey)

  const handleSave = () => {
    const trimmed = value.trim()
    if (trimmed.startsWith('AIza')) {
      setApiKey(trimmed)
      setEditing(false)
      setValue('')
    } else {
      alert('Invalid key format. Gemini API keys start with "AIza"')
    }
  }

  const handleClear = () => {
    setApiKey('')
    setEditing(true)
    setValue('')
  }

  // Key already saved — show confirmation
  if (apiKey && !editing) {
    return (
      <div className="rounded-lg border p-4 text-sm flex items-center justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <CheckCircle size={15} style={{ color: '#e8ff47' }} />
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
            API key set: {apiKey.slice(0, 8)}...{apiKey.slice(-4)}
          </span>
        </div>
        <button
          onClick={handleClear}
          className="px-3 py-1 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors hover:border-red-400/50 hover:text-red-400"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          <Trash2 size={11} /> Change
        </button>
      </div>
    )
  }

  // No key — show input
  return (
    <div className="rounded-lg border p-5 text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} style={{ color: '#e8ff47' }} />
        <h2 className="font-display font-bold text-base">Enter your API Key</h2>
      </div>
      <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
        This app is in <strong>Direct mode</strong> — your key is stored locally in your browser and
        never sent to any third-party server. Get a free key at{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 underline transition-colors hover:text-white" style={{ color: '#e8ff47' }}>
          aistudio.google.com <ExternalLink size={10} />
        </a>.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="AIza..."
          className="flex-1 px-3 py-2 text-xs rounded-lg border font-mono outline-none focus:border-yellow-300/50 transition-colors"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ background: '#e8ff47', color: '#000' }}
        >
          <Save size={12} /> Save
        </button>
      </div>
    </div>
  )
}
