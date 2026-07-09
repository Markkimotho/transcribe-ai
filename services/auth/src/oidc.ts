import { createHash, randomBytes } from 'node:crypto'

export interface OidcConfig {
  issuer: string
  clientId: string
  redirectUri: string
  scopes?: string[]
}

export interface Invite {
  email: string
  orgId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  expiresAt: number
}

export function validateOidcConfig(config: Partial<OidcConfig>): asserts config is OidcConfig {
  if (!config.issuer || !config.clientId || !config.redirectUri) {
    throw new Error('OIDC issuer, clientId, and redirectUri are required')
  }
  new URL(config.issuer)
  new URL(config.redirectUri)
}

export function buildAuthorizationUrl(config: OidcConfig, state: string, nonce = randomBytes(16).toString('base64url')): string {
  validateOidcConfig(config)
  const url = new URL('/authorize', config.issuer.endsWith('/') ? config.issuer : `${config.issuer}/`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', (config.scopes || ['openid', 'email', 'profile']).join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  return url.toString()
}

export function inviteToken(invite: Invite, secret: string): string {
  const body = Buffer.from(JSON.stringify(invite)).toString('base64url')
  const sig = createHash('sha256').update(`${body}.${secret}`).digest('base64url')
  return `${body}.${sig}`
}

export function verifyInviteToken(token: string, secret: string, now = Date.now()): Invite | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHash('sha256').update(`${body}.${secret}`).digest('base64url')
  if (expected !== sig) return null
  const invite = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Invite
  return invite.expiresAt > now ? invite : null
}
