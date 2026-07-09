import { useState, useContext, useCallback } from 'react'
import { AppContext } from '../context/AppContext'
import { transcribeViaProxy, transcribeDirect } from '../utils/transcribeApi'
import { buildPrompt, getDefaultOptions } from '../utils/promptBuilder'
import { uploadAudio, createJob, pollJob, getTranscript, saveTranscript } from '../utils/apiClient'

// Files above this go through the async job pipeline (upload → queue → poll)
// instead of the sync endpoint. Lifts the old 25MB ceiling.
const SYNC_MAX_BYTES = 20 * 1024 * 1024

export function useTranscribe() {
  const { apiMode, apiKey } = useContext(AppContext)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState('transcription')
  const [options, setOptions] = useState(getDefaultOptions('transcription'))
  const [savedId, setSavedId] = useState(null)

  const changeTask = useCallback((newTask) => {
    setTask(newTask)
    setOptions(getDefaultOptions(newTask))
  }, [])

  const handleLargeFile = async (file) => {
    setStatus('Uploading…')
    const blob = await uploadAudio(file)
    setStatus('Queued for transcription…')
    const job = await createJob({
      audioBlobId: blob.id, task, options, title: file.name.replace(/\.[^.]+$/, ''),
    })
    const done = await pollJob(job.id, {
      onProgress: j => setStatus(
        j.status === 'running' ? `Transcribing… ${j.progress}%` : `Job ${j.status}…`,
      ),
    })
    if (done.status !== 'succeeded') throw new Error(done.error || `Job ${done.status}`)
    const t = await getTranscript(done.transcript_id)
    setSavedId(t.id)
    return t.result ? String(t.result) : t.text
  }

  const handleSyncFile = async (file) => {
    const prompt = buildPrompt(task, options)
    setStatus('Transcribing with Whisper...')
    const result = apiMode === 'proxy'
      ? await transcribeViaProxy(file, { prompt, task, options })
      : await transcribeDirect(file, { prompt, task, options, apiKey })

    // Persist to the library (single-user mode needs no token; authed users
    // carry their JWT via apiClient). Non-fatal if it fails.
    try {
      const saved = await saveTranscript({
        title: file.name.replace(/\.[^.]+$/, ''),
        source: 'upload',
        task,
        text: typeof result === 'string' ? result : result.transcript,
      })
      setSavedId(saved.id)
    } catch { /* library unavailable — still show the transcript */ }
    return result
  }

  const handleFile = async (file) => {
    if (!file) return
    setLoading(true)
    setTranscript('')
    setError('')
    setSavedId(null)

    try {
      if (apiMode === 'direct' && !apiKey) throw new Error('Please enter your direct-mode key above.')
      const result = file.size > SYNC_MAX_BYTES
        ? await handleLargeFile(file)
        : await handleSyncFile(file)
      setTranscript(result)
      setStatus('Done!')
    } catch (err) {
      setError(err.message || 'Transcription failed. Please try again.')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return { transcript, status, error, loading, task, changeTask, options, setOptions, handleFile, savedId }
}
