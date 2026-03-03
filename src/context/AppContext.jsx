import { createContext, useState, useEffect } from 'react'

export const AppContext = createContext(null)

// "proxy"  → all calls go through your Express backend (key is hidden)
// "direct" → user enters their own Anthropic API key in the UI
const ENV_MODE = import.meta.env.VITE_API_MODE || 'direct'

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('theme') || 'dark'
  )
  const [apiMode, setApiMode] = useState(() =>
    localStorage.getItem('api_mode') || ENV_MODE
  )
  const [apiKey, setApiKey] = useState(() =>
    localStorage.getItem('anthropic_key') || ''
  )

  // Apply theme class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Persist user-supplied key
  useEffect(() => {
    if (apiKey) localStorage.setItem('anthropic_key', apiKey)
    else localStorage.removeItem('anthropic_key')
  }, [apiKey])

  // Persist api mode
  useEffect(() => {
    localStorage.setItem('api_mode', apiMode)
  }, [apiMode])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const toggleApiMode = () => setApiMode(m => m === 'proxy' ? 'direct' : 'proxy')

  return (
    <AppContext.Provider value={{ theme, toggleTheme, apiMode, toggleApiMode, apiKey, setApiKey }}>
      {children}
    </AppContext.Provider>
  )
}
