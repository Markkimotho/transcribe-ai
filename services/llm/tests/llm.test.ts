// Gate tests: adapter selection + prompt assembly. No network, no CLI.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getLlm, assemblePrompt, _setLlm } from '../src/index.ts'

test('assemblePrompt joins task prompt and context with a divider', () => {
  const p = assemblePrompt('TASK: SUMMARY', 'TRANSCRIPT:\nhello')
  assert.match(p, /^TASK: SUMMARY\n\n═+\n\nTRANSCRIPT:\nhello$/)
})

test('adapter selection honors LLM_ADAPTER and defaults to claude-local', () => {
  _setLlm(null)
  assert.equal(getLlm('claude-local').name, 'claude-local')
  _setLlm(null)
  assert.equal(getLlm('gemini').name, 'gemini')
  _setLlm(null)
  const saved = process.env.LLM_ADAPTER
  delete process.env.LLM_ADAPTER
  try { assert.equal(getLlm().name, 'claude-local') }
  finally { if (saved) process.env.LLM_ADAPTER = saved; _setLlm(null) }
})

test('unknown adapter throws with the valid list', () => {
  _setLlm(null)
  assert.throws(() => getLlm('gpt-9'), /Unknown LLM_ADAPTER=gpt-9.*claude-local.*gemini/s)
})

test('gemini adapter fails fast without an API key', async () => {
  _setLlm(null)
  const saved = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY
  try {
    const g = getLlm('gemini')
    await assert.rejects(() => g.run('t', 'c'), /GEMINI_API_KEY not configured/)
  } finally {
    if (saved) process.env.GEMINI_API_KEY = saved
    _setLlm(null)
  }
})
