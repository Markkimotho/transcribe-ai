// Gate tests: fs adapter round-trip in a temp dir + key namespacing. No network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { audioKey } from '../src/index.ts'
import { FsAdapter } from '../src/adapters/fs.ts'

function tempFs(): FsAdapter {
  process.env.STORAGE_FS_DIR = mkdtempSync(join(tmpdir(), 'semaje-storage-'))
  return new FsAdapter()
}

test('audioKey namespaces by org and sanitizes extension', () => {
  assert.equal(audioKey('org-1', 'blob-1', 'mp3'), 'org/org-1/audio/blob-1.mp3')
  assert.equal(audioKey('o', 'b', '../..//etc'), 'org/o/audio/b.etc')
  assert.equal(audioKey('o', 'b', ''), 'org/o/audio/b.bin')
})

test('fs adapter put/get/exists/delete round-trip', async () => {
  const fs = tempFs()
  const key = audioKey('org-a', 'blob-a', 'wav')
  const data = Buffer.from('RIFF-fake-audio')

  assert.equal(await fs.exists(key), false)
  await fs.put(key, data, 'audio/wav')
  assert.equal(await fs.exists(key), true)
  assert.deepEqual(await fs.get(key), data)
  await fs.delete(key)
  assert.equal(await fs.exists(key), false)
  await fs.delete(key) // idempotent
})

test('fs adapter rejects path-escaping keys', async () => {
  const fs = tempFs()
  await assert.rejects(() => fs.get('../../etc/passwd'), /path escape/)
})

test('fs adapter cannot presign (API falls back to direct upload)', async () => {
  const fs = tempFs()
  assert.equal(await fs.presignUpload(), null)
})
