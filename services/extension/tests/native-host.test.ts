import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-ignore plain JS native-host utility
import { decodeMessages, deriveNativeToken, encodeMessage } from '../native-host/framing.js'

test('native host message framing round-trips and preserves partial buffers', () => {
  const a = encodeMessage({ kind: 'ping' })
  const b = encodeMessage({ kind: 'dictation:text', text: 'hello' })
  const partial = Buffer.concat([a, b.subarray(0, 5)])
  const first = decodeMessages(partial)
  assert.deepEqual(first.messages, [{ kind: 'ping' }])
  const second = decodeMessages(Buffer.concat([first.rest, b.subarray(5)]))
  assert.deepEqual(second.messages, [{ kind: 'dictation:text', text: 'hello' }])
})

test('native token broker rejects refresh-token shaped values', () => {
  assert.equal(deriveNativeToken('access.jwt', 60, 0).tokenType, 'native-derived')
  assert.throws(() => deriveNativeToken('refresh.jwt'), /short-lived access token/)
})
