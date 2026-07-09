// Gate tests: query builders (org-scoping structural), exports, share tokens.
// No live Postgres.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildListQuery, buildGetQuery, buildDeleteQuery } from '../src/queries.ts'
import { toSRT, toVTT, toMD, exportTranscript } from '../src/exports.ts'
import { makeShareToken } from '../src/index.ts'

const ORG = 'org-1'
const SEGS = [
  { start: 0, end: 2.5, text: 'hello world' },
  { start: 2.5, end: 6.041, text: 'this is a test' },
]

test('list query without q is org-scoped and ordered by recency', () => {
  const { text, values } = buildListQuery(ORG, { limit: 20, offset: 0 })
  assert.match(text, /WHERE org_id = \$1/)
  assert.match(text, /ORDER BY created_at DESC/)
  assert.deepEqual(values, [ORG, 20, 0])
})

test('list query with q uses websearch FTS and rank ordering', () => {
  const { text, values } = buildListQuery(ORG, { q: 'launch date', limit: 10, offset: 5 })
  assert.match(text, /search_tsv @@ websearch_to_tsquery\('simple', \$2\)/)
  assert.match(text, /ORDER BY rank DESC/)
  assert.deepEqual(values, [ORG, 'launch date', 10, 5])
})

test('get/delete queries always require org_id — tenancy is structural', () => {
  assert.match(buildGetQuery(ORG, 't-1').text, /org_id = \$1 AND id = \$2/)
  assert.match(buildDeleteQuery(ORG, 't-1').text, /org_id = \$1 AND id = \$2/)
  assert.throws(() => buildListQuery('', { limit: 1, offset: 0 }), /orgId is required/)
  assert.throws(() => buildGetQuery('', 'x'), /orgId is required/)
  assert.throws(() => buildDeleteQuery('', 'x'), /orgId is required/)
})

test('SRT export: indexes, comma timecodes, blank-line separation', () => {
  const srt = toSRT(SEGS)
  assert.equal(srt, '1\n00:00:00,000 --> 00:00:02,500\nhello world\n\n2\n00:00:02,500 --> 00:00:06,041\nthis is a test\n')
})

test('VTT export: header + dot timecodes', () => {
  const vtt = toVTT(SEGS)
  assert.match(vtt, /^WEBVTT\n\n/)
  assert.match(vtt, /00:00:00\.000 --> 00:00:02\.500\nhello world/)
})

test('MD export includes title and [mm:ss] stamps', () => {
  const md = toMD('My call', 'fallback', SEGS)
  assert.match(md, /^# My call/)
  assert.match(md, /\*\*\[00:00\]\*\* hello world/)
  assert.match(md, /\*\*\[00:02\]\*\* this is a test/)
})

test('exportTranscript maps formats to mime types', () => {
  const t = { title: 'x', text: 'plain', segments: SEGS }
  assert.equal(exportTranscript('srt', t).mimeType, 'application/x-subrip')
  assert.equal(exportTranscript('vtt', t).mimeType, 'text/vtt')
  assert.equal(exportTranscript('txt', t).body, 'plain')
  assert.equal(exportTranscript('md', t).mimeType, 'text/markdown')
})

test('share tokens are long, URL-safe, and unique', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const tok = makeShareToken()
    assert.match(tok, /^[A-Za-z0-9_-]{20,}$/)
    assert.ok(!seen.has(tok))
    seen.add(tok)
  }
})
