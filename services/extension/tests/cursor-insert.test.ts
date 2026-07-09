// Gate tests: caret insertion across input / textarea / contenteditable (jsdom).
/// <reference lib="dom" />
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore — jsdom ships without bundled types; runtime-only use here
import { JSDOM } from 'jsdom'

let insertAtCursor: (el: unknown, text: string) => boolean
let isEditable: (el: unknown) => boolean
let dom: JSDOM

before(async () => {
  dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
  // The module reads window at import time for the content-script global.
  ;(globalThis as Record<string, unknown>).window = dom.window
  // @ts-ignore — plain JS content-script module
  const mod = await import('../src/content/cursor-insert.js')
  insertAtCursor = mod.insertAtCursor
  isEditable = mod.isEditable
})

function make(html: string) {
  dom.window.document.body.innerHTML = html
  return dom.window.document.body.firstElementChild as HTMLElement
}

test('isEditable: inputs, textareas, contenteditable yes; buttons/readonly no', () => {
  assert.equal(isEditable(make('<input type="text" />')), true)
  assert.equal(isEditable(make('<input type="email" />')), true)
  assert.equal(isEditable(make('<textarea></textarea>')), true)
  assert.equal(isEditable(make('<input type="checkbox" />')), false)
  assert.equal(isEditable(make('<input type="text" readonly />')), false)
  assert.equal(isEditable(make('<textarea disabled></textarea>')), false)
  assert.equal(isEditable(make('<button>x</button>')), false)
  const ce = make('<div contenteditable="true"></div>')
  Object.defineProperty(ce, 'isContentEditable', { value: true })
  assert.equal(isEditable(ce), true)
})

test('inserts at caret position inside an input', () => {
  const el = make('<input type="text" value="hello world" />') as HTMLInputElement
  el.selectionStart = el.selectionEnd = 5 // after "hello"
  assert.equal(insertAtCursor(el, ' brave'), true)
  assert.equal(el.value, 'hello brave world')
  assert.equal(el.selectionStart, 11) // caret after inserted text
})

test('replaces a selection inside a textarea', () => {
  const el = make('<textarea>delete THIS please</textarea>') as HTMLTextAreaElement
  el.selectionStart = 7
  el.selectionEnd = 11 // "THIS"
  insertAtCursor(el, 'THAT')
  assert.equal(el.value, 'delete THAT please')
})

test('appends into contenteditable without a selection inside it', () => {
  const el = make('<div contenteditable="true">note: </div>')
  Object.defineProperty(el, 'isContentEditable', { value: true })
  assert.equal(insertAtCursor(el, 'dictated text'), true)
  assert.equal(el.textContent, 'note: dictated text')
})

test('fires an input event so frameworks (React etc.) see the change', () => {
  const el = make('<input type="text" value="" />') as HTMLInputElement
  let fired = false
  el.addEventListener('input', () => { fired = true })
  insertAtCursor(el, 'x')
  assert.equal(fired, true)
})

test('refuses non-editable targets and empty text', () => {
  assert.equal(insertAtCursor(make('<button>x</button>'), 'nope'), false)
  const el = make('<input type="text" value="keep" />') as HTMLInputElement
  assert.equal(insertAtCursor(el, ''), false)
  assert.equal(el.value, 'keep')
})
