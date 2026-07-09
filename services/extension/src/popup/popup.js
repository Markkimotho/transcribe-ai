// popup — configure server URL + API key, test the connection.
/* global chrome */
const $ = (id) => document.getElementById(id)

chrome.storage.local.get(['apiBase', 'apiKey']).then(({ apiBase, apiKey }) => {
  $('apiBase').value = apiBase || 'http://localhost:3001'
  $('apiKey').value = apiKey || ''
})

$('save').addEventListener('click', async () => {
  const apiBase = $('apiBase').value.trim().replace(/\/$/, '') || 'http://localhost:3001'
  const apiKey = $('apiKey').value.trim()
  await chrome.storage.local.set({ apiBase, apiKey })
  $('msg').textContent = 'Testing…'
  try {
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    const res = await fetch(`${apiBase}/api/me`, { headers })
    if (res.ok) {
      $('msg').textContent = '✓ Connected. Dictation: focus a text box and press Cmd/Ctrl+Shift+1.'
    } else if (res.status === 401) {
      $('msg').textContent = '⚠ Server reached but the key was rejected (401).'
    } else {
      $('msg').textContent = `⚠ Server error ${res.status}.`
    }
  } catch {
    $('msg').textContent = '⚠ Cannot reach the server — is semaje running?'
  }
})

$('panel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.windowId != null) chrome.sidePanel.open({ windowId: tab.windowId })
})
