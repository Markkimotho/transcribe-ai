import { createContext, useState, useEffect, useCallback, useMemo } from 'react'
import { me, clearTokens, getRefreshToken } from '../utils/apiClient'

export const AppContext = createContext(null)

// "proxy"  -> all calls go through your backend (key is hidden)
// "direct" -> user enters their own fallback task key in the UI
const ENV_MODE = import.meta.env.VITE_API_MODE || 'proxy'
// "single-user" deployments need no login at all
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'single-user'
const ONBOARDING_KEY = 'semaje_onboarding'

const defaultOnboarding = {
  completed: false,
  workspaceName: '',
  primaryUse: 'meetings',
  captureSources: ['uploads', 'dictation'],
  extensionInterest: true,
}

function readOnboarding() {
  try {
    return { ...defaultOnboarding, ...JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}') }
  } catch {
    return defaultOnboarding
  }
}

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('theme') || 'dark'
  )
  const [apiMode, setApiMode] = useState(() =>
    localStorage.getItem('api_mode') || ENV_MODE
  )
  const [apiKey, setApiKey] = useState(() =>
    localStorage.getItem('gemini_key') || ''
  )
  const [onboarding, setOnboarding] = useState(readOnboarding)

  // ── Auth slice ─────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const authRequired = AUTH_MODE !== 'single-user'

  useEffect(() => {
    // single-user mode: the backend authenticates every request implicitly.
    if (!authRequired) { setAuthReady(true); return }
    if (!getRefreshToken()) { setAuthReady(true); return }
    me()
      .then(data => setUser({ id: data.principal.userId, orgId: data.principal.orgId, role: data.principal.role }))
      .catch(() => clearTokens())
      .finally(() => setAuthReady(true))
  }, [authRequired])

  const signOut = useCallback(() => { clearTokens(); setUser(null) }, [])
  const completeOnboarding = useCallback((next) => {
    setOnboarding(prev => ({ ...prev, ...next, completed: true }))
  }, [])
  const resetOnboarding = useCallback(() => {
    setOnboarding(defaultOnboarding)
  }, [])

  // Apply theme class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Persist user-supplied key
  useEffect(() => {
    if (apiKey) localStorage.setItem('gemini_key', apiKey)
    else localStorage.removeItem('gemini_key')
  }, [apiKey])

  // Persist api mode
  useEffect(() => {
    localStorage.setItem('api_mode', apiMode)
  }, [apiMode])

  useEffect(() => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(onboarding))
  }, [onboarding])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const toggleApiMode = () => setApiMode(m => m === 'proxy' ? 'direct' : 'proxy')
  const workspaceName = onboarding.workspaceName || (authRequired ? 'Team workspace' : 'Self-host workspace')
  const account = useMemo(() => ({
    workspaceName,
    mode: authRequired ? 'team' : 'single-user',
    authRequired,
  }), [workspaceName, authRequired])

  return (
    <AppContext.Provider value={{
      theme, toggleTheme, apiMode, toggleApiMode, apiKey, setApiKey,
      user, setUser, authReady, authRequired, signOut,
      onboarding, completeOnboarding, resetOnboarding, account,
    }}>
      {children}
    </AppContext.Provider>
  )
}
