// Pure transcript exporters — SRT / VTT / TXT / MD from Whisper segments.
import type { WhisperSegment } from '@semaje/schemas'

function pad(n: number, w = 2): string { return String(n).padStart(w, '0') }

function ts(seconds: number, sep: ',' | '.'): string {
  const s = Math.max(0, seconds)
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = Math.floor(s % 60)
  const ms = Math.round((s - Math.floor(s)) * 1000)
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${sep}${pad(ms, 3)}`
}

export function toSRT(segments: WhisperSegment[]): string {
  return segments
    .map((s, i) => `${i + 1}\n${ts(s.start, ',')} --> ${ts(s.end, ',')}\n${s.text}`)
    .join('\n\n') + (segments.length ? '\n' : '')
}

export function toVTT(segments: WhisperSegment[]): string {
  const body = segments
    .map(s => `${ts(s.start, '.')} --> ${ts(s.end, '.')}\n${s.text}`)
    .join('\n\n')
  return `WEBVTT\n\n${body}${segments.length ? '\n' : ''}`
}

export function toTXT(text: string): string { return text }

export function toMD(title: string, text: string, segments: WhisperSegment[] | null): string {
  const lines = [`# ${title}`, '']
  if (segments?.length) {
    for (const s of segments) {
      const mm = Math.floor(s.start / 60)
      const ss = Math.floor(s.start % 60)
      lines.push(`**[${pad(mm)}:${pad(ss)}]** ${s.text}`, '')
    }
  } else {
    lines.push(text, '')
  }
  return lines.join('\n')
}

export const EXPORT_FORMATS = ['srt', 'vtt', 'txt', 'md'] as const
export type ExportFormat = typeof EXPORT_FORMATS[number]

export function exportTranscript(
  format: ExportFormat,
  t: { title: string; text: string; segments: WhisperSegment[] | null },
): { body: string; mimeType: string } {
  switch (format) {
    case 'srt': return { body: toSRT(t.segments || []), mimeType: 'application/x-subrip' }
    case 'vtt': return { body: toVTT(t.segments || []), mimeType: 'text/vtt' }
    case 'txt': return { body: toTXT(t.text), mimeType: 'text/plain' }
    case 'md': return { body: toMD(t.title, t.text, t.segments), mimeType: 'text/markdown' }
  }
}
