import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, FileAudio, Mic, Users, Radio, Library, ArrowRight } from 'lucide-react'
import { listTranscripts } from '../../utils/apiClient'

const SOURCE_ICON = { upload: FileAudio, live: Radio, meeting: Users, dictation: Mic }

export default function LibraryPage() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      listTranscripts({ q })
        .then(setRows)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }, q ? 300 : 0) // debounce searches
    return () => clearTimeout(t)
  }, [q])

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8 flex flex-col gap-5">
      <section className="app-panel p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="eyebrow">Transcript memory</p>
            <h1 className="text-3xl font-semibold tracking-tight mt-1" style={{ color: 'var(--text)' }}>
              Library
            </h1>
            <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--muted)' }}>
              Find the recordings, dictations, and meeting notes that have already moved through semaje.
            </p>
          </div>
          <div className="rounded-xl border px-4 py-3 min-w-[8rem]" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-semibold">{rows.length}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>visible</div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl"
             style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--accent)' }} />
          <input
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text)' }}
            placeholder="Search transcript text, tasks, and titles..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </section>

      {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
      {loading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>}
      {!loading && rows.length === 0 && (
        <div className="soft-panel p-8 text-center">
          <Library size={28} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {q ? 'No matches yet.' : 'No transcripts yet. Create one from the capture deck and it will land here.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {rows.map(t => {
          const Icon = SOURCE_ICON[t.source] || FileAudio
          return (
            <Link
              key={t.id} to={`/t/${t.id}`}
              className="group flex items-start gap-3 p-4 rounded-xl transition-colors"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
                <Icon size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{t.title}</div>
                <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{t.preview}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {t.task} · {t.language || '-'} · {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
              <ArrowRight size={16} className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} />
            </Link>
          )
        })}
      </div>
    </main>
  )
}
