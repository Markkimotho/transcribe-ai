// Gate tests: JWT round-trip, API key generate/parse/verify, tenancy guard,
// single-user authenticate with a fake pool. No real Postgres, no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  signAccessToken, signRefreshToken, verifyToken,
  generateApiKey, parseApiKey, verifyApiKeySecret,
  assertSameOrg, assertRoleAtLeast, ForbiddenError,
  authenticate, ensureSeed, _resetSeed, AuthError,
} from '../src/index.ts'

const P = { userId: '11111111-1111-4111-8111-111111111111', orgId: '22222222-2222-4222-8222-222222222222', role: 'owner' as const, scopes: ['read'] }

test('JWT access token round-trips the principal', () => {
  const tok = signAccessToken(P)
  const back = verifyToken(tok, 'access')
  assert.equal(back.userId, P.userId)
  assert.equal(back.orgId, P.orgId)
  assert.equal(back.role, 'owner')
  assert.deepEqual(back.scopes, ['read'])
  assert.equal(back.via, 'jwt')
})

test('refresh token cannot be used as an access token', () => {
  const refresh = signRefreshToken(P)
  assert.throws(() => verifyToken(refresh, 'access'), /Expected access token/)
  assert.doesNotThrow(() => verifyToken(refresh, 'refresh'))
})

test('API key: generate → parse → verify; wrong secret rejected', () => {
  const k = generateApiKey()
  assert.match(k.token, /^smj_[0-9a-f]{12}_[A-Za-z0-9_-]+$/)
  const parsed = parseApiKey(k.token)
  assert.ok(parsed)
  assert.equal(parsed!.prefix, k.prefix)
  assert.equal(verifyApiKeySecret(parsed!.secret, k.hash), true)
  assert.equal(verifyApiKeySecret('wrong-secret-aaaaaaaaaaaa', k.hash), false)
  assert.equal(parseApiKey('smj_bad'), null)
  assert.equal(parseApiKey(''), null)
})

test('tenancy: cross-org access throws ForbiddenError', () => {
  const principal = { ...P, via: 'jwt' as const }
  assert.doesNotThrow(() => assertSameOrg(principal, P.orgId))
  assert.throws(() => assertSameOrg(principal, 'other-org'), ForbiddenError)
  assert.throws(() => assertSameOrg(principal, ''), ForbiddenError)
})

test('role gate ranks viewer < member < admin < owner', () => {
  const member = { ...P, role: 'member' as const, via: 'jwt' as const }
  assert.doesNotThrow(() => assertRoleAtLeast(member, 'member'))
  assert.doesNotThrow(() => assertRoleAtLeast(member, 'viewer'))
  assert.throws(() => assertRoleAtLeast(member, 'admin'), ForbiddenError)
})

// Fake pg pool: answers the seed queries in order.
function fakeSeedPool() {
  const calls: string[] = []
  return {
    calls,
    query(text: string, _params?: unknown[]) {
      calls.push(text)
      if (text.includes('INSERT INTO orgs')) return Promise.resolve({ rows: [{ id: P.orgId }] })
      if (text.includes('INSERT INTO users')) return Promise.resolve({ rows: [{ id: P.userId }] })
      return Promise.resolve({ rows: [] })
    },
  }
}

test('single-user mode authenticates with no credentials via the seed', async () => {
  process.env.AUTH_ADAPTER = 'single-user'
  _resetSeed()
  const pool = fakeSeedPool()
  const principal = await authenticate({}, pool as never)
  assert.equal(principal.via, 'single-user')
  assert.equal(principal.userId, P.userId)
  assert.equal(principal.orgId, P.orgId)
  assert.equal(principal.role, 'owner')
})

test('local-db mode rejects requests with no credentials', async () => {
  process.env.AUTH_ADAPTER = 'local-db'
  _resetSeed()
  await assert.rejects(() => authenticate({}, fakeSeedPool() as never), AuthError)
  process.env.AUTH_ADAPTER = 'single-user'
})

test('a valid JWT authenticates regardless of adapter', async () => {
  process.env.AUTH_ADAPTER = 'local-db'
  const tok = signAccessToken(P)
  const principal = await authenticate({ authorization: `Bearer ${tok}` }, fakeSeedPool() as never)
  assert.equal(principal.userId, P.userId)
  process.env.AUTH_ADAPTER = 'single-user'
})

test('ensureSeed is idempotent per process', async () => {
  _resetSeed()
  const pool = fakeSeedPool()
  const a = await ensureSeed(pool as never)
  const b = await ensureSeed(pool as never)
  assert.deepEqual(a, b)
  const inserts = pool.calls.filter(c => c.includes('INSERT INTO orgs')).length
  assert.equal(inserts, 1)
})
