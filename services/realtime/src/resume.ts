import { randomBytes } from 'node:crypto'

export interface ResumeState {
  token: string
  sessionId: string
  lastAckedSeq: number
  createdAt: number
  expiresAt: number
}

export function createResumeState(sessionId: string, ttlMs = 10 * 60_000, now = Date.now()): ResumeState {
  return {
    token: randomBytes(18).toString('base64url'),
    sessionId,
    lastAckedSeq: 0,
    createdAt: now,
    expiresAt: now + ttlMs,
  }
}

export function canResume(state: ResumeState | null, token: string, now = Date.now()): boolean {
  return !!state && state.token === token && state.expiresAt > now
}

export class DropOldestQueue<T> {
  private items: T[] = []
  public dropped = 0

  constructor(private readonly maxDepth: number) {
    if (maxDepth < 1) throw new Error('maxDepth must be >= 1')
  }

  push(item: T): void {
    if (this.items.length >= this.maxDepth) {
      this.items.shift()
      this.dropped++
    }
    this.items.push(item)
  }

  shift(): T | undefined { return this.items.shift() }
  get length(): number { return this.items.length }
  snapshot(): readonly T[] { return this.items }
}
