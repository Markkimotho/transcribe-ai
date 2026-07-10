// cursor-insert — inserts text at the caret of the focused editable element.
// Pure DOM logic, no chrome.* APIs, so it gate-tests under jsdom.
// Handles <input>, <textarea>, and contenteditable.

export function isEditable(el) {
  if (!el) return false
  const tag = (el.tagName || '').toLowerCase()
  if (tag === 'textarea') return !el.disabled && !el.readOnly
  if (tag === 'input') {
    const ok = ['text', 'search', 'url', 'tel', 'email', ''].includes((el.type || '').toLowerCase())
    return ok && !el.disabled && !el.readOnly
  }
  return el.isContentEditable === true || el.closest?.('[contenteditable="true"]') != null
}

function editableRoot(el) {
  if (!el) return null
  const tag = (el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea') return el
  return el.closest?.('[contenteditable="true"]') || (el.isContentEditable ? el : null)
}

export function insertAtCursor(el, text) {
  el = editableRoot(el)
  if (!isEditable(el) || !text) return false
  const tag = (el.tagName || '').toLowerCase()
  const win = el.ownerDocument?.defaultView || window
  const emitInput = () => el.dispatchEvent(new win.Event('input', { bubbles: true }))

  if (tag === 'input' || tag === 'textarea') {
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = el.value.slice(0, start) + text + el.value.slice(end)
    const prototype = tag === 'textarea' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    if (setter) setter.call(el, next)
    else el.value = next
    const pos = start + text.length
    el.selectionStart = el.selectionEnd = pos
    emitInput()
    return true
  }

  // contenteditable — use the Selection/Range API
  const doc = el.ownerDocument
  const sel = doc.defaultView.getSelection()
  if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const node = doc.createTextNode(text)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    el.appendChild(doc.createTextNode(text))
  }
  emitInput()
  return true
}

// Expose for the content-script sibling (non-module content scripts share window)
if (typeof window !== 'undefined') {
  window.__semajeInsert = { insertAtCursor, isEditable }
}
