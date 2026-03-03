import { useContext } from 'react'
import { AppContext, AppProvider } from './context/AppContext'
import Header from './components/Header'
import ApiKeySetup from './components/ApiKeySetup'
import Instructions from './components/Instructions'
import DropZone from './components/DropZone'
import OptionsBar from './components/OptionsBar'
import TranscriptOutput from './components/TranscriptOutput'
import Footer from './components/Footer'
import { useTranscribe } from './hooks/useTranscribe'

function MainApp() {
  const { apiMode, apiKey } = useContext(AppContext)
  const { transcript, status, error, loading, options, setOptions, handleFile } = useTranscribe()

  const needsKey = apiMode === 'direct' && !apiKey

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-12 flex flex-col gap-5">
        {needsKey && <ApiKeySetup />}
        <Instructions />
        <DropZone onFile={handleFile} disabled={loading || needsKey} />
        <OptionsBar options={options} onChange={setOptions} />
        {(loading || transcript || error) && (
          <TranscriptOutput
            transcript={transcript}
            status={status}
            error={error}
            loading={loading}
          />
        )}
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  )
}
