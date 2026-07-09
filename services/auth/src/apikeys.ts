// API keys: `smj_<prefix>_<secret>`. Only a bcrypt hash of the secret is
// stored; the prefix is the unique DB lookup handle.
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'

export interface GeneratedKey {
  token: string     // full key shown to the user once
  prefix: string    // stored plaintext, unique
  hash: string      // bcrypt of the secret part
}

export function generateApiKey(): GeneratedKey {
  const prefix = randomBytes(6).toString('hex')          // 12 chars
  const secret = randomBytes(24).toString('base64url')   // 32 chars
  return {
    token: `smj_${prefix}_${secret}`,
    prefix,
    hash: bcrypt.hashSync(secret, 10),
  }
}

/** Parses a presented key into { prefix, secret } or null if malformed. */
export function parseApiKey(token: string): { prefix: string; secret: string } | null {
  const m = /^smj_([0-9a-f]{12})_([A-Za-z0-9_-]{20,})$/.exec(token || '')
  return m ? { prefix: m[1], secret: m[2] } : null
}

export function verifyApiKeySecret(secret: string, hash: string): boolean {
  return bcrypt.compareSync(secret, hash)
}
