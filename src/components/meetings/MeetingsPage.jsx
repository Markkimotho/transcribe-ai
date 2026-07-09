import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, CalendarPlus, CheckCircle2, Clock, FileAudio, FileText, PlayCircle, Search, Sparkles, Users } from 'lucide-react'
import { createMeetingBotRun, listMeetingBotRuns, listTranscripts, startMeetingBotRun } from '../../utils/apiClient'

const channels = ['All', 'Sales', 'Customer calls', 'Internal', 'Research']

function looksLikeMeeting(row) {
  return row.source === 'meeting' || row.task === 'meeting' || /meeting|standup|sync|call|review/i.test(row.title || '')
}

export default function MeetingsPage() {
  const [q, setQ] = useState('')
  const [channel, setChannel] = useState('All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [botUrl, setBotUrl] = useState('')
  const [botRuns, setBotRuns] = useState([])
  const [botBusy, setBotBusy] = useState(false)
  const [botError, setBotError] = useState('')
  const [botMessage, setBotMessage] = useState('')

  const replaceBotRun = (nextRun) => {
    setBotRuns(prev => prev.map(run => (run.id === nextRun.id ? nextRun : run)))
  }

  useEffect(() => {
    setLoading(true)
    listTranscripts({ q, limit: 60 })
      .then(items => setRows(items.filter(looksLikeMeeting)))
      .finally(() => setLoading(false))
  }, [q])

  useEffect(() => {
    listMeetingBotRuns().then(setBotRuns).catch(() => {})
  }, [])

  const inviteBot = async (e) => {
    e.preventDefault()
    if (!botUrl.trim()) return
    setBotBusy(true)
    setBotError('')
    setBotMessage('')
    try {
      const run = await createMeetingBotRun({ joinUrl: botUrl.trim(), title: 'Ad hoc meeting' })
      setBotRuns(prev => [run, ...prev])
      setBotUrl('')
      const started = await startMeetingBotRun(run.id)
      replaceBotRun(started.run)
      setRows(prev => started.transcript ? [started.transcript, ...prev.filter(row => row.id !== started.transcript.id)] : prev)
      setBotMessage(`Bot joined ${run.provider} and saved meeting notes.`)
    } catch (err) {
      setBotError(err.message)
    } finally {
      setBotBusy(false)
    }
  }

  const startExistingBotRun = async (id) => {
    setBotBusy(true)
    setBotError('')
    setBotMessage('')
    try {
      const started = await startMeetingBotRun(id)
      replaceBotRun(started.run)
      setRows(prev => started.transcript ? [started.transcript, ...prev.filter(row => row.id !== started.transcript.id)] : prev)
      setBotMessage('Bot run completed and meeting notes are ready.')
    } catch (err) {
      setBotError(err.message)
    } finally {
      setBotBusy(false)
    }
  }

  const stats = useMemo(() => {
    const total = rows.length
    const completed = rows.filter(row => row.status === 'complete').length
    const thisWeek = rows.filter(row => Date.now() - new Date(row.created_at).getTime() < 7 * 86400_000).length
    return { total, completed, thisWeek }
  }, [rows])

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="app-panel signal-card p-5 sm:p-6 reveal-in">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <p className="eyebrow">Meetings</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Meeting notebook</h1>
              <p className="mt-2 text-sm muted max-w-2xl">
                Capture calls, turn them into summaries and action items, then route notes to the right channel.
              </p>
            </div>
            <Link to="/" className="primary-button">
              <CalendarPlus size={16} /> Capture meeting
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Meetings', stats.total, Users],
              ['Completed notes', stats.completed, CheckCircle2],
              ['This week', stats.thisWeek, Clock],
            ].map(([label, value, Icon]) => (
              <div key={label} className="soft-panel p-4">
                <Icon size={17} style={{ color: 'var(--accent)' }} />
                <div className="mt-3 text-2xl font-semibold">{value}</div>
                <div className="text-xs muted">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col md:flex-row gap-3">
            <div className="field-row flex-1">
              <Search size={16} style={{ color: 'var(--muted)' }} />
              <input className="field-input" placeholder="Search meetings, decisions, customers..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {channels.map(item => (
                <button
                  key={item}
                  className="secondary-button whitespace-nowrap"
                  style={item === channel ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : null}
                  onClick={() => setChannel(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="app-panel p-4 reveal-in stagger-1">
          <div className="bot-radar mb-4">
            <div className="bot-core">
              <Bot size={20} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Bot size={16} /> Bot invite</div>
          <p className="mt-2 text-xs muted">
            Paste a Zoom, Meet, or Teams URL. semaje will join the run, track it, and save notes here.
          </p>
          <form onSubmit={inviteBot}>
            <input
              className="mt-4 w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder="https://meet.google.com/..."
              value={botUrl}
              onChange={e => setBotUrl(e.target.value)}
            />
            <button className="primary-button w-full mt-3" disabled={!botUrl.trim() || botBusy}>
              {botBusy ? 'Creating...' : 'Invite bot'}
            </button>
          </form>
          {botMessage && <p className="mt-3 text-xs" style={{ color: 'var(--success)' }}>{botMessage}</p>}
          {botError && <p className="mt-3 text-xs" style={{ color: 'var(--danger)' }}>{botError}</p>}
          <div className="mt-4 grid gap-2">
            {botRuns.slice(0, 4).map(run => (
              <div key={run.id} className="soft-panel p-3 reveal-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{run.provider} bot</div>
                  {run.state === 'invited' && (
                    <button className="secondary-button !px-2 !py-1" disabled={botBusy} onClick={() => startExistingBotRun(run.id)} title="Start bot">
                      <PlayCircle size={14} />
                    </button>
                  )}
                  {run.transcript_id && (
                    <Link className="secondary-button !px-2 !py-1" to={`/t/${run.transcript_id}`} title="Open notes">
                      <FileText size={14} />
                    </Link>
                  )}
                </div>
                <div className="text-xs muted mt-1">{run.state} · {new Date(run.created_at).toLocaleString()}</div>
                <div className="text-xs muted mt-1 truncate">{run.join_url}</div>
              </div>
            ))}
          </div>
          {botUrl && !botMessage && (
            <p className="mt-3 text-xs muted">Bot run will use meeting task processing, speaker labels, timestamps, and library auto-save.</p>
          )}
        </aside>
      </section>

      <section className="mt-5 grid gap-3">
        {loading && <p className="text-sm muted">Loading meetings...</p>}
        {!loading && rows.length === 0 && (
          <div className="soft-panel p-8 text-center">
            <FileAudio size={28} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} />
            <p className="text-sm muted">No meeting transcripts yet. Capture or upload a meeting to start building your notebook.</p>
          </div>
        )}
        {rows.map(row => (
          <Link key={row.id} to={`/t/${row.id}`} className="app-panel p-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center reveal-in">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="font-semibold truncate">{row.title}</h2>
              </div>
              <p className="text-sm muted mt-1 truncate">{row.preview}</p>
              <p className="text-xs muted mt-2">{row.task} · {row.source} · {new Date(row.created_at).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <span className="secondary-button">Summary</span>
              <span className="secondary-button">Actions</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}
