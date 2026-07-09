import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canResume, createResumeState, DropOldestQueue } from '../src/resume.ts'

test('resume token is bounded by token match and expiry', () => {
  const state = createResumeState('session-1', 1000, 10_000)
  assert.equal(canResume(state, state.token, 10_500), true)
  assert.equal(canResume(state, 'wrong', 10_500), false)
  assert.equal(canResume(state, state.token, 12_000), false)
})

test('drop-oldest queue keeps latency bounded', () => {
  const q = new DropOldestQueue<number>(2)
  q.push(1)
  q.push(2)
  q.push(3)
  assert.deepEqual(q.snapshot(), [2, 3])
  assert.equal(q.dropped, 1)
  assert.equal(q.shift(), 2)
  assert.equal(q.shift(), 3)
  assert.equal(q.shift(), undefined)
})
