import { useState, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import { login, register } from '../../utils/apiClient'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)',
}

export default function LoginPage() {
  const { setUser, authRequired } = useContext(AppContext)
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!authRequired) {
    // single-user deploys have no login
    navigate('/', { replace: true })
    return null
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await register(email, password, name)
      setUser(user)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex-1 w-full max-w-sm mx-auto px-4 py-16 flex flex-col gap-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === 'register' && (
          <input style={inputStyle} placeholder="Display name" value={name} onChange={e => setName(e.target.value)} />
        )}
        <input style={inputStyle} type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={inputStyle} type="password" required minLength={mode === 'register' ? 8 : 1} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>}
        <button
          type="submit" disabled={busy}
          className="py-2.5 rounded-xl font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <button
        onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
        className="text-sm underline self-start" style={{ color: 'var(--muted)' }}
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </main>
  )
}
