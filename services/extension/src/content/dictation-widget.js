// dictation-widget — floating mic button that appears near focused text
// fields (Grammarly-style). Click (or Cmd+Shift+1) to dictate; final text
// from the semaje realtime service is inserted at the caret.
/* global chrome */
(() => {
  const { insertAtCursor, isEditable } = window.__semajeInsert || {}
  if (!insertAtCursor) return

  let lastEditable = null
  let listening = false

  // ── Shadow-DOM widget (site CSS can't bleed in) ────────────
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;z-index:2147483647;display:none;'
  const shadow = host.attachShadow({ mode: 'closed' })
  const btn = document.createElement('button')
  btn.setAttribute('aria-label', 'Dictate with semaje')
  btn.innerHTML = '🎙'
  const style = document.createElement('style')
  style.textContent = `
    button {
      width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg,#e8ff47,#ff6b35); font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,.25); transition: transform .15s;
    }
    button:hover { transform: scale(1.1); }
    button.listening { animation: pulse 1.2s infinite; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 8px rgba(255,107,53,.25); } }
  `
  shadow.append(style, btn)
  document.documentElement.appendChild(host)

  function positionNear(el) {
    const r = el.getBoundingClientRect()
    host.style.top = `${Math.max(4, r.top + 4)}px`
    host.style.left = `${Math.min(window.innerWidth - 40, r.right - 36)}px`
    host.style.display = 'block'
  }

  document.addEventListener('focusin', (e) => {
    if (isEditable(e.target)) {
      lastEditable = e.target
      positionNear(e.target)
    }
  })
  document.addEventListener('focusout', () => {
    if (!listening) setTimeout(() => { host.style.display = 'none' }, 200)
  })

  function setListening(on, error) {
    listening = on
    btn.classList.toggle('listening', on)
    btn.innerHTML = on ? '⏺' : error ? '⚠️' : '🎙'
    if (on && lastEditable) positionNear(lastEditable)
  }

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault() // keep focus in the text field
    chrome.runtime.sendMessage({ kind: listening ? 'dictation:stop' : 'dictation:start' })
  })

  // ── Messages from the service worker ───────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.kind === 'dictation:text' && msg.final && lastEditable) {
      insertAtCursor(lastEditable, (msg.text.endsWith(' ') ? msg.text : msg.text + ' '))
    } else if (msg?.kind === 'dictation:state') {
      setListening(msg.state === 'listening', msg.state === 'error')
    }
  })
})()
