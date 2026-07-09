import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertBotTransition, buildIngestJobInput, canBotTransition, detectMeetingProvider, pickJoinAdapter } from '../src/index.ts'

test('bot join state machine allows only safe transitions', () => {
  assert.equal(canBotTransition('invited', 'joined'), true)
  assert.equal(canBotTransition('joined', 'recording'), true)
  assert.equal(canBotTransition('recording', 'left'), true)
  assert.equal(canBotTransition('left', 'recording'), false)
  assert.throws(() => assertBotTransition('left', 'joined'), /Illegal bot transition/)
})

test('meeting provider adapter is selected from provider/url', () => {
  assert.equal(pickJoinAdapter({ id: '1', title: 'A', startsAt: '', provider: 'zoom', joinUrl: 'https://example.com' }), 'zoom')
  assert.equal(pickJoinAdapter({ id: '2', title: 'B', startsAt: '', joinUrl: 'https://meet.google.com/abc-defg-hij' }), 'meet')
  assert.equal(pickJoinAdapter({ id: '3', title: 'C', startsAt: '', joinUrl: 'https://teams.microsoft.com/l/meetup-join/x' }), 'teams')
  assert.equal(detectMeetingProvider('https://example.zoom.us/j/123'), 'zoom')
})

test('bot completed recording becomes a meeting job input', () => {
  const input = buildIngestJobInput({ id: '1', title: 'Weekly review', startsAt: '', provider: 'meet', joinUrl: 'https://meet.google.com/x' }, '33333333-3333-4333-8333-333333333333')
  assert.equal(input.task, 'meeting')
  assert.equal(input.source, 'meeting')
  assert.equal(input.title, 'Weekly review')
  assert.equal(input.options.speakerLabels, true)
})
