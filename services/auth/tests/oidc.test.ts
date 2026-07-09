import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAuthorizationUrl, inviteToken, validateOidcConfig, verifyInviteToken } from '../src/oidc.ts'

test('OIDC config validation rejects incomplete cloud setup', () => {
  assert.throws(() => validateOidcConfig({ issuer: 'https://issuer.example' }), /required/)
})

test('authorization URL contains standard code-flow parameters', () => {
  const url = new URL(buildAuthorizationUrl({
    issuer: 'https://issuer.example',
    clientId: 'client-1',
    redirectUri: 'https://app.example/callback',
  }, 'state-1', 'nonce-1'))
  assert.equal(url.origin, 'https://issuer.example')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('client_id'), 'client-1')
  assert.equal(url.searchParams.get('state'), 'state-1')
  assert.equal(url.searchParams.get('nonce'), 'nonce-1')
})

test('invite token verifies role/org and rejects expiry or wrong secret', () => {
  const invite = { email: 'a@example.com', orgId: 'org-1', role: 'member' as const, expiresAt: 20_000 }
  const token = inviteToken(invite, 'secret')
  assert.deepEqual(verifyInviteToken(token, 'secret', 10_000), invite)
  assert.equal(verifyInviteToken(token, 'wrong', 10_000), null)
  assert.equal(verifyInviteToken(token, 'secret', 30_000), null)
})
