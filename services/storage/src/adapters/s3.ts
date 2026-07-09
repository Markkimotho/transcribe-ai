// s3 adapter — MinIO (self-host) and S3/GCS (cloud) through the same S3 API.
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { StorageAdapter, PresignedUpload } from '../index.ts'

export class S3Adapter implements StorageAdapter {
  readonly name = 's3'
  private client: S3Client
  private bucket = process.env.S3_BUCKET || 'semaje'

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined, // MinIO: http://minio:9000
      forcePathStyle: !!process.env.S3_ENDPOINT,      // required for MinIO
      credentials: process.env.S3_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY || '',
          }
        : undefined,
    })
  }

  async put(key: string, data: Buffer, mimeType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: data, ContentType: mimeType,
    }))
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    return Buffer.from(await res.Body!.transformToByteArray())
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))
      return true
    } catch { return false }
  }

  async presignUpload(key: string, mimeType: string): Promise<PresignedUpload | null> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType }),
      { expiresIn: 900 },
    )
    return { url, method: 'PUT', headers: { 'Content-Type': mimeType } }
  }
}
