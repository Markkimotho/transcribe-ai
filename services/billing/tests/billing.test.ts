import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateUsage, enforcePlanLimit, signStripeFixture, verifyStripeSignature } from '../src/index.ts'

test('usage aggregates round seconds up to billable minutes', () => {
  assert.deepEqual(aggregateUsage([
    { durationSec: 61, storageBytes: 500_000_000 },
    { durationSec: 59, storageBytes: 750_000_000 },
  ]), { minutes: 2, storageGb: 1.25 })
})

test('plan limit blocks over-quota jobs with reason', () => {
  assert.deepEqual(
    enforcePlanLimit({ minutes: 9, storageGb: 1 }, { durationSec: 120, storageBytes: 1 }, { minutes: 10, storageGb: 5 }),
    { allowed: false, reason: 'minutes quota exceeded' },
  )
  assert.deepEqual(
    enforcePlanLimit({ minutes: 1, storageGb: 4.9 }, { durationSec: 1, storageBytes: 200_000_000 }, { minutes: 10, storageGb: 5 }),
    { allowed: false, reason: 'storage quota exceeded' },
  )
})

test('Stripe-style webhook signature verifies raw body and timestamp', () => {
  const body = '{"type":"checkout.session.completed"}'
  const header = signStripeFixture(body, 'whsec_test', 1_000)
  const realNow = Date.now
  Date.now = () => 1_050_000
  try {
    assert.equal(verifyStripeSignature(body, header, 'whsec_test'), true)
    assert.equal(verifyStripeSignature(body, header, 'wrong'), false)
  } finally {
    Date.now = realNow
  }
})
