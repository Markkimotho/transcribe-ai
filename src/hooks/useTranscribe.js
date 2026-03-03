import { useState, useContext, useCallback } from 'react'
import { AppContext } from '../context/AppContext'
import { transcribeViaProxy, transcribeDirect } from '../utils/transcribeApi'
import { buildPrompt, getDefaultOptions } from '../utils/promptBuilder'

export function useTranscribe() {
  const { apiMode, apiKey } = useContext(AppContext)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState('transcription')
  const [options, setOptions] = useState(getDefaultOptions('transcription'))

  const changeTask = useCallback((newTask) => {
    setTask(newTask)
    setOptions(getDefaultOptions(newTask))
  }, [])

  const handleFile = async (file) => {
    if (!file) return
    setLoading(true)
    setTranscript('')
    setError('')
    setStatus('Building prompt...')

    try {
      const prompt = buildPrompt(task, options)
      let result
      if (apiMode === 'proxy') {
        setStatus('Sending to server...')
        result = await transcribeViaProxy(file, prompt)
      } else {
        if (!apiKey) throw new Error('Please enter your Gemini API key above.')
        setStatus('Sending to Gemini AI...')
        result = await transcribeDirect(file, prompt, apiKey)
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

  return { transcript, status, error, loading, task, changeTask, options, setOptions, handleFile }
}
