// fs adapter — local disk. The smallest self-host deployment (no MinIO).
import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'
import type { StorageAdapter, PresignedUpload } from '../index.ts'

export class FsAdapter implements StorageAdapter {
  readonly name = 'fs'
  private base = process.env.STORAGE_FS_DIR || join(process.cwd(), 'data', 'blobs')

  private resolve(key: string): string {
    const p = normalize(join(this.base, key))
    if (!p.startsWith(normalize(this.base))) {
      throw new Error(`Invalid storage key (path escape): ${key}`)
    }
    return p
  }

  async put(key: string, data: Buffer, _mimeType: string): Promise<void> {
    const p = this.resolve(key)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, data)
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key))
  }

  async delete(key: string): Promise<void> {
    try { await unlink(this.resolve(key)) } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  }

  async exists(key: string): Promise<boolean> {
    try { await access(this.resolve(key)); return true } catch { return false }
  }

  async presignUpload(): Promise<PresignedUpload | null> {
    return null // fs can't presign — API falls back to direct upload
  }
}
