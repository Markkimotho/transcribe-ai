import { useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { Sun, Moon, Server, KeyRound, ArrowLeftRight } from 'lucide-react'

export default function Header() {
  const { theme, toggleTheme, apiMode, toggleApiMode } = useContext(AppContext)
  return (
    <header className="w-full border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#e8ff47,#ff6b35)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xl tracking-tight"
              style={{ background: 'linear-gradient(135deg,#e8ff47,#ff6b35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              TranscribeAI
            </h1>
            <button
              onClick={toggleApiMode}
              className="flex items-center gap-1.5 text-[10px] font-mono transition-colors hover:text-yellow-300/80 group"
              style={{ color: 'var(--muted)' }}
              title="Click to switch API mode"
            >
              {apiMode === 'proxy'
                ? <><Server size={10} /> Server mode</>
                : <><KeyRound size={10} /> Direct mode</>
              }
              <ArrowLeftRight size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg border transition-colors hover:border-yellow-300/50"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}
