// side panel — browse/search/copy your semaje transcript library.
/* global chrome */

const $ = (id) => document.getElementById(id)
let cfg = { apiBase: 'http://localhost:3001', apiKey: '' }

async function api(path) {
  const headers = cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}
  const res = await fetch(`${cfg.apiBase}${path}`, { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s || ''
  return d.innerHTML
}

async function load(q = '') {
  $('status').textContent = 'Loading…'
  $('detail').textContent = ''
  $('back').style.display = 'none'
  try {
    const params = new URLSearchParams({ limit: 30 })
    if (q) params.set('q', q)
    const { transcripts } = await api(`/api/transcripts?${params}`)
    $('list').innerHTML = transcripts.length
      ? transcripts.map(t => `
        <div class="item" data-id="${t.id}">
          <div class="title">${esc(t.title)}</div>
          <div class="meta">${esc(t.task)} · ${new Date(t.created_at).toLocaleString()}</div>
          <div class="preview">${esc(t.preview)}</div>
          <div class="actions">
            <button data-open="${t.id}">open</button>
            <button data-copy="${t.id}">copy</button>
          </div>
        </div>`).join('')
      : '<p style="opacity:.6">No transcripts yet.</p>'
    $('status').textContent = ''
  } catch (e) {
    $('status').textContent = `⚠ ${e.message} — check the server URL / API key in the popup.`
    $('list').innerHTML = ''
  }
}

async function open(id) {
  const { transcript } = await api(`/api/transcripts/${id}`)
  $('list').innerHTML = ''
  $('back').style.display = 'block'
  $('detail').innerHTML = `<div class="title">${esc(transcript.title)}</div>` +
    `<div class="meta">${esc(transcript.task)} · ${new Date(transcript.created_at).toLocaleString()}</div>` +
    `<p>${esc(transcript.result ? String(transcript.result) : transcript.text)}</p>`
}

$('list').addEventListener('click', async (e) => {
  const openId = e.target.dataset?.open
  const copyId = e.target.dataset?.copy
  if (openId) return open(openId)
  if (copyId) {
    const { transcript } = await api(`/api/transcripts/${copyId}`)
    await navigator.clipboard.writeText(transcript.text)
    e.target.textContent = 'copied ✓'
    setTimeout(() => { e.target.textContent = 'copy' }, 1200)
  }
})

$('back').addEventListener('click', () => load($('search').value))

let debounce
$('search').addEventListener('input', (e) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(e.target.value), 300)
})

chrome.storage.local.get(['apiBase', 'apiKey']).then((stored) => {
  cfg = { ...cfg, ...stored }
  load()
})
