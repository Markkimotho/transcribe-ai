// service-worker — event hub. Brokers dictation between the content script
// (widget) and the offscreen document (mic + WS), and opens the side panel.
/* global chrome */

const OFFSCREEN_PATH = 'src/offscreen/offscreen.html'
let dictationTabId = null

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.()
  if (has) return
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Microphone capture for voice dictation',
  })
}

async function getConfig() {
  const { apiBase = 'http://localhost:3001', apiKey = '' } =
    await chrome.storage.local.get(['apiBase', 'apiKey'])
  return { apiBase, apiKey }
}

async function startDictation(tabId) {
  dictationTabId = tabId
  await ensureOffscreen()
  const cfg = await getConfig()
  chrome.runtime.sendMessage({ kind: 'offscreen:start', ...cfg })
}

function stopDictation() {
  chrome.runtime.sendMessage({ kind: 'offscreen:stop' })
}

function toTab(msg) {
  if (dictationTabId != null) chrome.tabs.sendMessage(dictationTabId, msg).catch(() => {})
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  switch (msg?.kind) {
    case 'dictation:start':
      startDictation(sender.tab?.id)
      break
    case 'dictation:stop':
      stopDictation()
      break
    // Relayed from the offscreen document:
    case 'offscreen:text':
      toTab({ kind: 'dictation:text', text: msg.text, final: true })
      break
    case 'offscreen:state':
      toTab({ kind: 'dictation:state', state: msg.state, error: msg.error })
      break
  }
})

// Keyboard shortcut toggles dictation on the active tab
chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'toggle-dictation') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  if (dictationTabId == null) startDictation(tab.id)
  else stopDictation()
})

// Toolbar icon opens the side panel (library)
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {})
