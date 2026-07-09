# Transcripts Service — Contract

Persistent transcript library. Every read/write is **org-scoped by construction**
(query builders require `orgId`; callers pass the authenticated `Principal`).

```ts
createTranscript(principal, CreateTranscriptRequest) -> row
listTranscripts(principal, {q?, limit, offset}) -> rows   // q = Postgres websearch FTS
getTranscript(principal, id) -> row | null
deleteTranscript(principal, id) -> {id, audio_blob_id} | null
createShare(principal, transcriptId, {permission, expiresInDays?}) -> share row (token)
getByShareToken(token) -> public row | null               // token IS the credential
exportTranscript('srt'|'vtt'|'txt'|'md', {title,text,segments}) -> {body, mimeType}
```

Search: `search_tsv` generated column (title weighted A, text B), GIN index,
`websearch_to_tsquery('simple', q)`, rank-ordered. Swap seam: replace the query
builders with a Meilisearch/Elastic client later without changing this contract.
