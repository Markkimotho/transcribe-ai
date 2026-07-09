import { createHmac, timingSafeEqual } from 'node:crypto'

export interface UsageEvent {
  durationSec: number
  storageBytes: number
}

export interface UsageTotals {
  minutes: number
  storageGb: number
}

export interface PlanLimits {
  minutes: number
  storageGb: number
}

export function aggregateUsage(events: UsageEvent[]): UsageTotals {
  const durationSec = events.reduce((sum, event) => sum + Math.max(0, event.durationSec), 0)
  const storageBytes = events.reduce((sum, event) => sum + Math.max(0, event.storageBytes), 0)
  return {
    minutes: Math.ceil(durationSec / 60),
    storageGb: Number((storageBytes / 1_000_000_000).toFixed(3)),
  }
}

export function enforcePlanLimit(current: UsageTotals, incoming: UsageEvent, limits: PlanLimits): { allowed: boolean; reason?: string } {
  const next = aggregateUsage([
    { durationSec: current.minutes * 60, storageBytes: current.storageGb * 1_000_000_000 },
    incoming,
  ])
  if (next.minutes > limits.minutes) return { allowed: false, reason: 'minutes quota exceeded' }
  if (next.storageGb > limits.storageGb) return { allowed: false, reason: 'storage quota exceeded' }
  return { allowed: true }
}

export function verifyStripeSignature(rawBody: string, header: string, secret: string, toleranceSec = 300): boolean {
  const parts = Object.fromEntries(header.split(',').map(part => {
    const [k, v] = part.split('=')
    return [k, v]
  }))
  const ts = Number(parts.t)
  const sig = parts.v1
  if (!Number.isFinite(ts) || !sig) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSec) return false
  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(sig, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function signStripeFixture(rawBody: string, secret: string, ts: number): string {
  const sig = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  return `t=${ts},v1=${sig}`
}
