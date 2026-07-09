import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ClipboardList, Copy, Download, Highlighter, Link2, MessageSquareText, Sparkles, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { getTranscript, deleteTranscript, createShare, exportUrl } from '../../utils/apiClient'

function splitLines(text = '') {
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean)
}

function deriveInsights(t) {
  const result = t?.result ? String(t.result) : ''
  const text = t?.text || ''
  const source = result || text
  const lines = splitLines(source)
  const actionLines = lines.filter(line => /action|todo|follow|owner|due|\[ \]/i.test(line)).slice(0, 8)
  const decisions = lines.filter(line => /decision|decided|agreed|approved/i.test(line)).slice(0, 6)
  const summary = result || splitLines(text).slice(0, 5).join('\n\n') || 'No summary is available yet.'
  const soundbites = splitLines(text)
    .filter(line => line.length > 80)
    .slice(0, 4)
    .map((line, i) => ({ label: `Clip ${i + 1}`, text: line.slice(0, 220) }))
  return {
    summary,
    actions: actionLines.length ? actionLines : ['Review transcript and assign owners.', 'Share notes with attendees.'],
    decisions: decisions.length ? decisions : ['No explicit decisions detected yet.'],
    soundbites,
  }
}

export default function TranscriptDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [tab, setTab] = useState('summary')

  useEffect(() => {
    getTranscript(id).then(setT).catch(e => setError(e.message))
  }, [id])

  const insights = useMemo(() => deriveInsights(t), [t])

  const copy = async () => {
    await navigator.clipboard.writeText(t.result ? String(t.result) : t.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const share = async () => {
    const s = await createShare(id)
    const url = `${location.origin}/share/${s.token}`
    await navigator.clipboard.writeText(url)
    setShareUrl(url)
  }

  const remove = async () => {
    if (!confirm('Delete this transcript permanently?')) return
    await deleteTranscript(id)
    navigate('/library')
  }

  if (error) return <main className="flex-1 max-w-2xl mx-auto px-4 py-12"><p style={{ color: 'var(--danger)' }}>{error}</p></main>
  if (!t) return <main className="flex-1 max-w-2xl mx-auto px-4 py-12"><p className="muted">Loading...</p></main>

  const tabs = [
    ['summary', 'AI notes', Sparkles],
    ['actions', 'Action items', ClipboardList],
    ['soundbites', 'Soundbites', Highlighter],
    ['transcript', 'Transcript', MessageSquareText],
  ]

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm mb-4 muted">
        <ArrowLeft size={14} /> Back
      </button>

      <section className="app-panel p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="eyebrow">{t.source === 'meeting' || t.task === 'meeting' ? 'Meeting' : 'Transcript'}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t.title}</h1>
            <div className="text-sm mt-2 muted">
              {t.task} · {t.source} · {t.language || '-'} · {t.duration_sec ? `${Math.round(t.duration_sec)}s` : '-'} · {new Date(t.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} Copy</button>
            <button className="secondary-button" onClick={share}><Link2 size={14} /> Share</button>
            {['txt', 'md', 'srt', 'vtt'].map(f => (
              <a key={f} className="secondary-button" href={exportUrl(id, f)} download>
                <Download size={14} /> {f.toUpperCase()}
              </a>
            ))}
            <button className="danger-button" onClick={remove}><Trash2 size={14} /> Delete</button>
          </div>
        </div>
        {shareUrl && <p className="mt-4 text-xs break-all muted">Share link copied: {shareUrl}</p>}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)_18rem] items-start">
        <aside className="app-panel p-3">
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
              style={tab === key ? { background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--text)' } : { color: 'var(--muted)' }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </aside>

        <article className="app-panel p-5 sm:p-6 min-h-[28rem]">
          {tab === 'summary' && (
            <div className="prose-sm max-w-none" style={{ color: 'var(--text)' }}>
              <ReactMarkdown>{insights.summary}</ReactMarkdown>
            </div>
          )}
          {tab === 'actions' && (
            <div className="grid gap-4">
              <div>
                <h2 className="text-lg font-semibold">Action items</h2>
                <div className="mt-3 grid gap-2">
                  {insights.actions.map((item, i) => (
                    <label key={i} className="check-row mt-0">
                      <input type="checkbox" />
                      <span>{item.replace(/^[-*]\s*/, '')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Decisions</h2>
                <ul className="mt-3 grid gap-2">
                  {insights.decisions.map((item, i) => <li key={i} className="soft-panel p-3 text-sm">{item}</li>)}
                </ul>
              </div>
            </div>
          )}
          {tab === 'soundbites' && (
            <div>
              <h2 className="text-lg font-semibold">Soundbites</h2>
              <p className="text-sm muted mt-1">Shareable highlights inferred from longer transcript moments.</p>
              <div className="mt-4 grid gap-3">
                {(insights.soundbites.length ? insights.soundbites : [{ label: 'Clip 1', text: 'No long highlight moments detected yet.' }]).map(item => (
                  <div key={item.label} className="soft-panel p-4">
                    <div className="text-xs font-mono muted">{item.label}</div>
                    <p className="mt-2 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'transcript' && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{t.text}</div>
          )}
        </article>

        <aside className="app-panel p-4">
          <h2 className="text-sm font-semibold">Conversation intelligence</h2>
          <div className="mt-4 grid gap-3">
            {[
              ['Action items', insights.actions.length],
              ['Decisions', insights.decisions.length],
              ['Soundbites', insights.soundbites.length],
              ['Words', (t.text || '').split(/\s+/).filter(Boolean).length],
            ].map(([label, value]) => (
              <div key={label} className="soft-panel p-3">
                <div className="text-xl font-semibold">{value}</div>
                <div className="text-xs muted">{label}</div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  )
}
