// JWT issue/verify — HS256 platform tokens carried by web app + extension.
import jwt from 'jsonwebtoken'
import type { Principal } from '@semaje/schemas'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '1h'
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d'

export interface TokenClaims {
  sub: string      // userId
  org: string      // orgId
  role: string
  scopes: string[]
  typ: 'access' | 'refresh'
}

export function signAccessToken(p: Omit<Principal, 'via'>): string {
  const claims: TokenClaims = { sub: p.userId, org: p.orgId, role: p.role, scopes: p.scopes, typ: 'access' }
  return jwt.sign(claims, SECRET, { expiresIn: ACCESS_TTL } as jwt.SignOptions)
}

export function signRefreshToken(p: Omit<Principal, 'via'>): string {
  const claims: TokenClaims = { sub: p.userId, org: p.orgId, role: p.role, scopes: [], typ: 'refresh' }
  return jwt.sign(claims, SECRET, { expiresIn: REFRESH_TTL } as jwt.SignOptions)
}

export function verifyToken(token: string, expected: 'access' | 'refresh' = 'access'): Principal {
  const c = jwt.verify(token, SECRET) as TokenClaims
  if (c.typ !== expected) throw new Error(`Expected ${expected} token, got ${c.typ}`)
  return {
    userId: c.sub,
    orgId: c.org,
    role: c.role as Principal['role'],
    scopes: c.scopes || [],
    via: 'jwt',
  }
}
