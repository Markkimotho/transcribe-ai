import { useState, useContext } from 'react'
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
import { useTranscribe } from './hooks/useTranscribe'
import { useLiveTranscribe } from './hooks/useLiveTranscribe'

function MainApp() {
  const { apiMode, apiKey } = useContext(AppContext)
  const { transcript, status, error, loading, task, changeTask, options, setOptions, handleFile } = useTranscribe()
  const liveTranscribe = useLiveTranscribe()

  const [activeTab, setActiveTab] = useState('upload')

  const showKeySetup = apiMode === 'direct'
  const isBlocked = apiMode === 'direct' && !apiKey

  const handleTabChange = (tab) => {
    if (tab !== 'live' && liveTranscribe.isRecording) {
      liveTranscribe.stopRecording()
    }
    setActiveTab(tab)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-12 flex flex-col gap-5">
        {showKeySetup && <ApiKeySetup />}
        <Instructions />
        <TabSwitcher activeTab={activeTab} onChange={handleTabChange} />

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
              />
            )}
          </>
        )}

        {activeTab === 'live' && (
          <LiveTranscription liveTranscribe={liveTranscribe} isBlocked={isBlocked} />
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
