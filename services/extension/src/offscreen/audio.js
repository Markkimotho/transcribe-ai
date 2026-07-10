// offscreen audio — MV3 service workers can't hold getUserMedia, so the
// offscreen document owns the mic AND the realtime WebSocket. Final text
// is relayed to the service worker → content script → caret.
/* global chrome */

let ws = null
let recorder = null
let stream = null

function state(s, error) {
  chrome.runtime.sendMessage({ kind: 'offscreen:state', state: s, error })
}

function detectMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm'
}

async function start({ apiBase, apiKey }) {
  if (ws) return
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (e) {
    state('error', 'Microphone permission denied — allow mic access for the extension.')
    return
  }

  const mimeType = detectMimeType()
  const wsBase = apiBase.replace(/^http/, 'ws')
  ws = new WebSocket(`${wsBase}/ws${apiKey ? `?token=${encodeURIComponent(apiKey)}` : ''}`)
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'start', mode: 'dictation', source: 'extension',
      title: `Browser dictation ${new Date().toLocaleString()}`, mimeType,
    }))
    recorder = new MediaRecorder(stream, { mimeType })
    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0 && ws?.readyState === WebSocket.OPEN) {
        e.data.arrayBuffer().then(buf => ws.send(buf))
      }
    }
    recorder.start(1000)
    state('listening')
  }
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return
    const msg = JSON.parse(e.data)
    if (msg.type === 'final' && msg.text) {
      chrome.runtime.sendMessage({ kind: 'offscreen:text', text: msg.text })
    } else if (msg.type === 'error') {
      console.warn('[semaje]', msg.error)
    } else if (msg.type === 'end') {
      chrome.runtime.sendMessage({ kind: 'offscreen:saved', transcriptId: msg.transcriptId })
      cleanup()
    }
  }
  ws.onerror = () => { state('error', 'Cannot reach the semaje server.'); cleanup() }
  ws.onclose = () => { if (recorder) cleanup() }
}

function stop() {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  recorder = null
  // Give the final chunk a beat to flush, then close the session.
  setTimeout(() => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }))
    state('idle')
  }, 200)
}

function cleanup() {
  stream?.getTracks().forEach(t => t.stop())
  stream = null
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  recorder = null
  try { ws?.close() } catch { /* already closed */ }
  ws = null
  state('idle')
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.kind === 'offscreen:start') start(msg)
  else if (msg?.kind === 'offscreen:stop') stop()
})
