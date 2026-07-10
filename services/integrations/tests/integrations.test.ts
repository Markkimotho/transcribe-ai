import { test } from 'node:test'
import assert from 'node:assert/strict'
import { integrationStatus } from '../src/index.ts'

test('integrations are default-off and expose no credential values', () => {
  const previous = { ...process.env }
  delete process.env.INTEGRATION_FILE_SYNC_DIR
  delete process.env.NEXTCLOUD_WEBDAV_URL
  delete process.env.SLACK_WEBHOOK_URL
  delete process.env.TEAMS_WEBHOOK_URL
  delete process.env.SMTP_URL
  try {
    const status = integrationStatus()
    assert.deepEqual(status.adapters, {
      local: false, nextcloud: false, slack: false, teams: false, email: false,
    })
    assert.equal(JSON.stringify(status).includes('password'), false)
  } finally {
    Object.assign(process.env, previous)
  }
})

test('sharing can be disabled globally or constrained to local clients', () => {
  const enabled = process.env.SHARING_ENABLED
  const local = process.env.SHARE_LOCAL_ONLY
  process.env.SHARING_ENABLED = 'false'
  process.env.SHARE_LOCAL_ONLY = 'true'
  try {
    assert.deepEqual(integrationStatus().sharing, { enabled: false, localOnly: true })
  } finally {
    if (enabled == null) delete process.env.SHARING_ENABLED; else process.env.SHARING_ENABLED = enabled
    if (local == null) delete process.env.SHARE_LOCAL_ONLY; else process.env.SHARE_LOCAL_ONLY = local
  }
})
