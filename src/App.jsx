import { useState, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
import { ArrowRight, AudioWaveform, CheckCircle2, Database, FileAudio, ListChecks, Mic2, PlugZap, Puzzle, Search } from 'lucide-react'
import { AppContext, AppProvider } from './context/AppContext'
import Header from './components/Header'
import ApiKeySetup from './components/ApiKeySetup'
import Instructions from './components/Instructions'
import TabSwitcher from './components/TabSwitcher'
import TaskSelector from './components/TaskSelector'
import DropZone from './components/DropZone'
import OptionsBar from './components/OptionsBar'
import TranscriptOutput from './components/TranscriptOutput'
import LiveTranscription from './components/LiveTranscription'
import Footer from './components/Footer'
import LoginPage from './components/auth/LoginPage'
import LibraryPage from './components/library/LibraryPage'
import TranscriptDetailPage from './components/library/TranscriptDetailPage'
import SharePage from './components/library/SharePage'
import ApiKeysPage from './components/settings/ApiKeysPage'
import PlatformSettingsPage from './components/settings/PlatformSettingsPage'
import IntegrationsPage from './components/settings/IntegrationsPage'
import MeetingsPage from './components/meetings/MeetingsPage'
import OnboardingPage from './components/onboarding/OnboardingPage'
import { useTranscribe } from './hooks/useTranscribe'
import { useLiveTranscribe } from './hooks/useLiveTranscribe'
import { useRealtimeTranscribe } from './hooks/useRealtimeTranscribe'

function TranscribeScreen() {
  const { apiMode, apiKey, onboarding, account } = useContext(AppContext)
  const { transcript, status, error, loading, task, changeTask, options, setOptions, handleFile, savedId } = useTranscribe()
  const legacyLive = useLiveTranscribe()
  const realtimeLive = useRealtimeTranscribe()

  const [activeTab, setActiveTab] = useState('upload')

  const showKeySetup = apiMode === 'direct'
  const isBlocked = apiMode === 'direct' && !apiKey
  const liveTranscribe = apiMode === 'proxy'
    ? {
        isRecording: realtimeLive.isRecording,
        isProcessing: false,
        segments: realtimeLive.segments,
        error: realtimeLive.error,
        savedId: realtimeLive.savedId,
        startRecording: () => realtimeLive.start({ mode: 'dictation', title: `${account.workspaceName} dictation` }),
        stopRecording: realtimeLive.stop,
        clearSegments: realtimeLive.clear,
      }
    : legacyLive

  const handleTabChange = (tab) => {
    if (tab !== 'live' && liveTranscribe.isRecording) liveTranscribe.stopRecording()
    setActiveTab(tab)
  }

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      <section className="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-5 items-start">
        <aside className="app-panel signal-card p-4 lg:sticky lg:top-24 reveal-in">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Workspace</div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight">{account.workspaceName}</h1>
            </div>
            <span className="status-dot" aria-hidden="true" />
          </div>
          <p className="mt-2 text-sm muted">
            Capture meetings, generate notes, track action items, share clips, and search every conversation.
          </p>

          <div className="waveform-strip mt-5" aria-hidden="true">
            {[38, 72, 48, 88, 56, 66, 42, 78, 52, 92, 46, 68, 40, 74].map((height, index) => (
              <span key={index} style={{ '--h': `${height}%`, '--d': `${index * 0.055}s` }} />
            ))}
          </div>

          <div className="mt-5 grid gap-2">
            {[
              ['STT', 'Local Whisper', AudioWaveform],
              ['Library', 'Full-text search', Database],
              ['LLM', apiMode === 'proxy' ? 'Server adapter' : 'Direct fallback', PlugZap],
              ['Setup', onboarding.completed ? 'Complete' : 'Needs review', ListChecks],
            ].map(([label, value, Icon]) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-transform hover:-translate-y-0.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <Icon size={15} style={{ color: 'var(--accent)' }} />
                <div className="min-w-0">
                  <div className="text-xs muted">{label}</div>
                  <div className="text-sm font-medium truncate">{value}</div>
                </div>
              </div>
            ))}
          </div>

          {!onboarding.completed && (
            <Link to="/onboarding" className="primary-button w-full mt-4">
              Finish setup <ArrowRight size={15} />
            </Link>
          )}

          <Link to="/meetings" className="secondary-button w-full mt-3">
            <Search size={15} /> Meeting notebook
          </Link>

          {onboarding.extensionInterest && (
            <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 text-sm font-semibold"><Puzzle size={15} /> Extension slice</div>
              <p className="mt-1 text-xs muted">Dictation widget and side-panel library are scaffolded under `services/extension`.</p>
            </div>
          )}
        </aside>

        <div className="flex flex-col gap-4 min-w-0 reveal-in stagger-1">
          {showKeySetup && <ApiKeySetup />}
          <div className="app-panel p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="eyebrow">Capture</p>
                <h2 className="text-2xl font-semibold tracking-tight mt-1">Create a transcript</h2>
                <p className="text-sm muted mt-1">Record a call, upload meeting audio, or dictate notes. Results land in the meeting notebook.</p>
              </div>
              <TabSwitcher activeTab={activeTab} onChange={handleTabChange} />
            </div>

            {activeTab === 'upload' && (
              <>
                <TaskSelector task={task} onTaskChange={changeTask} />
                <DropZone onFile={handleFile} disabled={loading || isBlocked} />
                <OptionsBar task={task} options={options} onChange={setOptions} />
                {(loading || transcript || error) && (
                  <TranscriptOutput
                    transcript={transcript}
                    status={status}
                    error={error}
                    loading={loading}
                    savedId={savedId}
                  />
                )}
              </>
            )}

            {activeTab === 'live' && (
              <LiveTranscription liveTranscribe={liveTranscribe} isBlocked={false} />
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3 reveal-in stagger-2">
            {[
              ['Upload', 'Batch audio or video', FileAudio],
              ['Dictate', apiMode === 'proxy' ? 'Realtime WebSocket' : 'Legacy HTTP chunks', Mic2],
              ['Saved', savedId || realtimeLive.savedId ? 'Latest transcript saved' : 'Ready to persist', CheckCircle2],
            ].map(([title, detail, Icon]) => (
              <div key={title} className="soft-panel p-4">
                <Icon size={17} style={{ color: 'var(--accent)' }} />
                <div className="mt-3 text-sm font-semibold">{title}</div>
                <div className="text-xs muted mt-1">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function RequireAuth({ children }) {
  const { user, authReady, authRequired } = useContext(AppContext)
  const location = useLocation()
  if (!authReady) return null
  if (authRequired && !user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function RequireOnboarding({ children }) {
  const { onboarding } = useContext(AppContext)
  const location = useLocation()
  if (!onboarding.completed && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" state={{ from: location }} replace />
  }
  return children
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col app-backdrop" style={{ background: 'var(--bg)' }}>
      <div className="ambient-grid" aria-hidden="true" />
      <div className="motion-trace" aria-hidden="true" />
      <Header />
      {children}
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Shell><LoginPage /></Shell>} />
          <Route path="/onboarding" element={<Shell><RequireAuth><OnboardingPage /></RequireAuth></Shell>} />
          <Route path="/share/:token" element={<Shell><SharePage /></Shell>} />
          <Route path="/" element={<Shell><RequireAuth><RequireOnboarding><TranscribeScreen /></RequireOnboarding></RequireAuth></Shell>} />
          <Route path="/meetings" element={<Shell><RequireAuth><RequireOnboarding><MeetingsPage /></RequireOnboarding></RequireAuth></Shell>} />
          <Route path="/library" element={<Shell><RequireAuth><RequireOnboarding><LibraryPage /></RequireOnboarding></RequireAuth></Shell>} />
          <Route path="/t/:id" element={<Shell><RequireAuth><RequireOnboarding><TranscriptDetailPage /></RequireOnboarding></RequireAuth></Shell>} />
          <Route path="/settings/api-keys" element={<Shell><RequireAuth><RequireOnboarding><ApiKeysPage /></RequireOnboarding></RequireAuth></Shell>} />
          <Route path="/settings/platform" element={<Shell><RequireAuth><RequireOnboarding><PlatformSettingsPage /></RequireOnboarding></RequireAuth></Shell>} />
          <Route path="/settings/integrations" element={<Shell><RequireAuth><RequireOnboarding><IntegrationsPage /></RequireOnboarding></RequireAuth></Shell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
