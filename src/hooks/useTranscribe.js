import { useState, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { transcribeViaProxy, transcribeDirect } from '../utils/transcribeApi'

export function useTranscribe() {
  const { apiMode, apiKey } = useContext(AppContext)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState({
    speakerLabels: true,
    timestamps: false,
  })

  const handleFile = async (file) => {
    if (!file) return
    setLoading(true)
    setTranscript('')
    setError('')
    setStatus('Reading file...')

    try {
      let result
      if (apiMode === 'proxy') {
        setStatus('Sending to server...')
        result = await transcribeViaProxy(file, options)
      } else {
        if (!apiKey) throw new Error('Please enter your Anthropic API key above.')
        setStatus('Sending to Claude AI...')
        result = await transcribeDirect(file, options, apiKey)
      }
      setTranscript(result)
      setStatus('Done!')
    } catch (err) {
      setError(err.message || 'Transcription failed. Please try again.')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return { transcript, status, error, loading, options, setOptions, handleFile }
}
