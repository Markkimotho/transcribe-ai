// Public read-only share view — no auth; the token is the credential.
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getShared } from '../../utils/apiClient'

export default function SharePage() {
  const { token } = useParams()
  const [t, setT] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getShared(token).then(setT).catch(e => setError(e.message))
  }, [token])

  if (error) return <main className="flex-1 max-w-2xl mx-auto px-4 py-12"><p style={{ color: '#f87171' }}>{error}</p></main>
  if (!t) return <main className="flex-1 max-w-2xl mx-auto px-4 py-12"><p style={{ color: 'var(--muted)' }}>Loading…</p></main>

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-12 flex flex-col gap-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>{t.title}</h1>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        Shared transcript · {t.language || '-'} · {new Date(t.created_at).toLocaleString()}
      </div>
      <article
        className="p-5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        {t.text}
      </article>
    </main>
  )
}
