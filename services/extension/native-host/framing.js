export function encodeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32LE(body.length, 0)
  return Buffer.concat([header, body])
}

export function decodeMessages(buffer) {
  const messages = []
  let offset = 0
  while (buffer.length - offset >= 4) {
    const len = buffer.readUInt32LE(offset)
    if (buffer.length - offset - 4 < len) break
    const raw = buffer.subarray(offset + 4, offset + 4 + len).toString('utf8')
    messages.push(JSON.parse(raw))
    offset += 4 + len
  }
  return { messages, rest: buffer.subarray(offset) }
}

export function deriveNativeToken(accessToken, expiresInSec = 300, now = Date.now()) {
  if (!accessToken || accessToken.includes('refresh')) throw new Error('native host requires a short-lived access token')
  return {
    accessToken,
    expiresAt: new Date(now + expiresInSec * 1000).toISOString(),
    tokenType: 'native-derived',
  }
}
