import { useState, useContext, useCallback } from 'react'
import { AppContext } from '../context/AppContext'
import { transcribeViaProxy, transcribeDirect } from '../utils/transcribeApi'
import { buildPrompt, getDefaultOptions } from '../utils/promptBuilder'
import { ingestAudio, pollJob, getTranscript, saveTranscript } from '../utils/apiClient'

export function useTranscribe() {
  const { apiMode, apiKey } = useContext(AppContext)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState('transcription')
  const [options, setOptions] = useState(getDefaultOptions('transcription'))
  const [savedId, setSavedId] = useState(null)
  const [jobId, setJobId] = useState(null)

  const changeTask = useCallback((newTask) => {
    setTask(newTask)
    setOptions(getDefaultOptions(newTask))
  }, [])

  const handleQueuedFile = async (file) => {
    setStatus('Uploading recording...')
    const { job } = await ingestAudio(file, {
      task, options, source: 'upload', title: file.name.replace(/\.[^.]+$/, ''),
      captureMeta: { client: 'web', lastModified: file.lastModified },
    })
    setJobId(job.id)
    setStatus('Waiting for a worker...')
    const done = await pollJob(job.id, {
      onProgress: j => setStatus(
        j.status === 'running' ? `Transcribing... ${j.progress}%` : `Job ${j.status}...`,
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
    const text = result.transcript
    try {
      const saved = await saveTranscript({
        title: file.name.replace(/\.[^.]+$/, ''),
        source: 'upload',
        task,
        text,
        language: result.whisper?.language,
        durationSec: result.whisper?.duration,
        segments: result.whisper?.segments,
        speakerLabels: result.speakerLabels,
        qualityMeta: result.qualityMeta,
        result: result.result,
        processingMeta: result.processingMeta,
      })
      setSavedId(saved.id)
    } catch { /* library unavailable — still show the transcript */ }
    return text
  }

  const handleFile = async (file) => {
    if (!file) return
    setLoading(true)
    setTranscript('')
    setError('')
    setSavedId(null)
    setJobId(null)

    try {
      if (apiMode === 'direct' && !apiKey) throw new Error('Please enter your direct-mode key above.')
      const result = apiMode === 'proxy'
        ? await handleQueuedFile(file)
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

  return { transcript, status, error, loading, task, changeTask, options, setOptions, handleFile, savedId, jobId }
}
