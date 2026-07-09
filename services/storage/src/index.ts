// ═══════════════════════════════════════════════════════════════
// services/storage — pluggable object store for audio + exports.
// Adapters: fs (local disk, default) | s3 (MinIO/S3/GCS, same code).
// ═══════════════════════════════════════════════════════════════

export interface PresignedUpload {
  url: string
  method: 'PUT'
  headers?: Record<string, string>
}

export interface StorageAdapter {
  readonly name: string
  put(key: string, data: Buffer, mimeType: string): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  /**
   * Presigned direct-upload URL, or null when the adapter can't presign
   * (fs) — callers then fall back to the API's direct-upload endpoint.
   */
  presignUpload(key: string, mimeType: string): Promise<PresignedUpload | null>
}

/** Storage keys are namespaced by org for tenancy: org/<orgId>/audio/<blobId>.<ext> */
export function audioKey(orgId: string, blobId: string, ext: string): string {
  const safeExt = (ext || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  return `org/${orgId}/audio/${blobId}.${safeExt}`
}

let active: StorageAdapter | null = null

export async function getStorage(
  name = process.env.STORAGE_ADAPTER || 'fs',
): Promise<StorageAdapter> {
  if (active && active.name === name) return active
  if (name === 'fs') {
    const { FsAdapter } = await import('./adapters/fs.ts')
    active = new FsAdapter()
  } else if (name === 's3') {
    const { S3Adapter } = await import('./adapters/s3.ts')
    active = new S3Adapter()
  } else {
    throw new Error(`Unknown STORAGE_ADAPTER=${name}. Use 'fs' or 's3'.`)
  }
  return active
}

/** Test seam. */
export function _setStorage(a: StorageAdapter | null): void { active = a }
