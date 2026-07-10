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
  btn.title = 'Dictate with semaje'
  btn.innerHTML = '<span class="mic"><i></i></span>'
  const style = document.createElement('style')
  style.textContent = `
    button {
      display:grid; place-items:center; width:32px; height:32px; border-radius:8px;
      border:1px solid rgba(255,255,255,.18); cursor:pointer; color:white;
      background:#101817; box-shadow:0 5px 18px rgba(0,0,0,.28); transition:transform .15s,background .15s;
    }
    button:hover { transform:translateY(-1px); background:#173330; }
    button.listening { background:#ce5a38; animation:pulse 1.2s infinite; }
    button.error { background:#a53430; }
    .mic { position:relative; display:block; width:12px; height:16px; }
    .mic::before { content:""; position:absolute; left:3px; top:0; width:6px; height:10px; border:1.5px solid currentColor; border-radius:4px; }
    .mic::after { content:""; position:absolute; left:1px; top:7px; width:10px; height:6px; border:1.5px solid currentColor; border-top:0; border-radius:0 0 7px 7px; }
    .mic i { position:absolute; left:5px; bottom:0; width:2px; height:4px; background:currentColor; }
    @keyframes pulse { 50% { box-shadow:0 0 0 7px rgba(206,90,56,.22); } }
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
    btn.classList.toggle('error', Boolean(error))
    btn.title = error || (on ? 'Stop semaje dictation' : 'Dictate with semaje')
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
    } else if (msg?.kind === 'dictation:saved' && msg.transcriptId) {
      btn.title = 'Dictation saved to semaje'
    }
  })

  window.addEventListener('scroll', () => { if (lastEditable && host.style.display !== 'none') positionNear(lastEditable) }, true)
  window.addEventListener('resize', () => { if (lastEditable && host.style.display !== 'none') positionNear(lastEditable) })
})()
