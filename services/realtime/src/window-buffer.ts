// WindowBuffer — turns a live MediaRecorder byte stream into decodable
// ~5s windows. Container formats (webm/ogg/mp4) put the codec header in the
// FIRST chunk only, so we cache it and prepend it to every later window —
// otherwise ffmpeg can't decode window 2+. Same bounded-queue heuristic
// proven in src/hooks/useLiveTranscribe.js, lifted server-side.

export const WINDOW_MS = 5000
export const MIN_WINDOW_BYTES = 3000

export class WindowBuffer {
  private initSegment: Buffer | null = null
  private pending: Buffer[] = []
  private pendingBytes = 0
  private firstWindow = true

  feed(chunk: Buffer): void {
    if (!this.initSegment) {
      this.initSegment = chunk
      // The init chunk also carries the first audio clusters — it IS the
      // start of window 1, not just a header.
    }
    this.pending.push(chunk)
    this.pendingBytes += chunk.length
  }

  get bufferedBytes(): number { return this.pendingBytes }
  get hasInit(): boolean { return this.initSegment !== null }

  /**
   * Assembles the next decodable window, or null when below the minimum.
   * Window 1 = the raw chunks (init included). Window 2+ = init + new chunks.
   */
  flush(minBytes = MIN_WINDOW_BYTES): Buffer | null {
    if (this.pendingBytes < minBytes || this.pending.length === 0) return null
    const chunks = this.pending.splice(0)
    this.pendingBytes = 0
    const parts = this.firstWindow || !this.initSegment
      ? chunks
      : [this.initSegment, ...chunks]
    this.firstWindow = false
    return Buffer.concat(parts)
  }

  /** Drains whatever is left regardless of the minimum (used on stop). */
  drain(): Buffer | null {
    return this.flush(1)
  }
}
