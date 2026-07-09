# Storage Service — Contract

Pluggable object store for audio blobs + exports. `STORAGE_ADAPTER`: `fs`
(default) | `s3` (MinIO/S3/GCS — same adapter, `S3_ENDPOINT` for MinIO).

```ts
getStorage() -> StorageAdapter
put(key, Buffer, mimeType) / get(key) -> Buffer / delete(key) / exists(key)
presignUpload(key, mimeType) -> {url, method, headers} | null
  // null = adapter can't presign (fs) → callers use POST /api/uploads
audioKey(orgId, blobId, ext) -> 'org/<orgId>/audio/<blobId>.<ext>'  // tenancy-namespaced
```

Keys are validated against path escape in the fs adapter. Blob METADATA lives
in Postgres (`audio_blobs`); only bytes live here.
