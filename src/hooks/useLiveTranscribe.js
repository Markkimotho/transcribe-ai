import { useState, useRef, useContext, useCallback } from 'react'
import { AppContext } from '../context/AppContext'
import { transcribeViaProxy, transcribeDirect } from '../utils/transcribeApi'

const LIVE_PROMPT = `You are a real-time transcription engine processing a short audio segment (approximately 5 seconds) captured from a live microphone. Transcribe every audible word exactly as spoken with natural punctuation. If the segment contains no speech, return exactly: [silence]. Return only the transcription text, no preamble, no commentary, no markdown.`

const CHUNK_MS = 5000
const MIN_CHUNK_BYTES = 3000
const MAX_QUEUE_DEPTH = 2 // drop oldest if API is slower than recording

// MIME type fallback chain for cross-browser compatibility
function detectMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4;codecs=aac',
    'audio/mp4',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm'
}

export function useLiveTranscribe() {
  const { apiMode, apiKey } = useContext(AppContext)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [segments, setSegments] = useState([])
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const audioBlobQueueRef = useRef([])  // raw blobs from MediaRecorder between interval ticks
  const apiQueueRef = useRef([])        // assembled chunks waiting for an API call slot
  const apiActiveRef = useRef(false)    // true while an API call is in-flight
  const mimeTypeRef = useRef('audio/webm')
  // Keep stable refs to apiMode/apiKey so the queue processor always uses current values
  const apiModeRef = useRef(apiMode)
  const apiKeyRef = useRef(apiKey)
  apiModeRef.current = apiMode
  apiKeyRef.current = apiKey

  // Process the next chunk in the serial queue — called after each API call finishes
  const processNext = useCallback(() => {
    if (apiActiveRef.current) return
    if (apiQueueRef.current.length === 0) {
      setIsProcessing(false)
      return
    }

    const chunk = apiQueueRef.current.shift()
    apiActiveRef.current = true
    setIsProcessing(true)

    const segId = Date.now() + Math.random()
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setSegments(prev => [...prev, { id: segId, text: '', timestamp, status: 'processing' }])

    const file = new File([chunk], 'live-chunk.webm', { type: mimeTypeRef.current })

    const call = apiModeRef.current === 'proxy'
      ? transcribeViaProxy(file, LIVE_PROMPT)
      : apiKeyRef.current
        ? transcribeDirect(file, LIVE_PROMPT, apiKeyRef.current)
        : Promise.reject(new Error('No API key set.'))

    call
      .then(text => {
        const trimmed = text?.trim() || ''
        setSegments(prev =>
          trimmed === '[silence]' || trimmed === ''
            ? prev.filter(s => s.id !== segId)
            : prev.map(s => s.id === segId ? { ...s, text: trimmed, status: 'done' } : s)
        )
      })
      .catch(err => {
        console.warn('[Live chunk error]', err.message)
        setSegments(prev =>
          prev.map(s => s.id === segId ? { ...s, text: '⚠ chunk failed', status: 'error' } : s)
        )
      })
      .finally(() => {
        apiActiveRef.current = false
        processNext() // pull next chunk from queue
      })
  }, []) // stable — reads apiMode/apiKey from refs

  // Assemble collected blobs into a chunk and enqueue it
  const enqueueChunk = useCallback(() => {
    const blobs = audioBlobQueueRef.current.splice(0)
    if (blobs.length === 0) return
    const chunk = new Blob(blobs, { type: mimeTypeRef.current })
    if (chunk.size < MIN_CHUNK_BYTES) return

    // Drop oldest chunk if we're already backed up — keeps latency bounded
    if (apiQueueRef.current.length >= MAX_QUEUE_DEPTH) {
      apiQueueRef.current.shift()
    }
    apiQueueRef.current.push(chunk)
    processNext()
  }, [processNext])

  const startRecording = useCallback(async () => {
    setError('')

    if (!window.MediaRecorder) {
      setError('Your browser does not support live recording. Please use Chrome, Firefox, or Edge.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const mimeType = detectMimeType()
      mimeTypeRef.current = mimeType

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioBlobQueueRef.current.push(e.data)
      }

      recorder.start() // no timeslice — requestData() from interval is more reliable

      intervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.requestData()
        }
        // Small delay so ondataavailable fires before we collect the blobs
        setTimeout(enqueueChunk, 50)
      }, CHUNK_MS)

      setIsRecording(true)
    } catch (err) {
      setError(err.message || 'Microphone access denied.')
    }
  }, [enqueueChunk])

  const stopRecording = useCallback(() => {
    clearInterval(intervalRef.current)
    intervalRef.current = null

    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        // Flush any remaining audio
        setTimeout(enqueueChunk, 50)
      }
      recorder.stop()
    }
    mediaRecorderRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    setIsRecording(false)
  }, [enqueueChunk])

  const clearSegments = useCallback(() => {
    setSegments([])
    setError('')
  }, [])

  return { isRecording, isProcessing, segments, error, startRecording, stopRecording, clearSegments }
}
