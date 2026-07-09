export type BotState = 'invited' | 'joined' | 'recording' | 'left' | 'failed'

const TRANSITIONS: Record<BotState, BotState[]> = {
  invited: ['joined', 'failed'],
  joined: ['recording', 'left', 'failed'],
  recording: ['left', 'failed'],
  left: [],
  failed: [],
}

export interface CalendarEvent {
  id: string
  title: string
  startsAt: string
  joinUrl: string
  provider?: 'zoom' | 'meet' | 'teams'
}

export function canBotTransition(from: BotState, to: BotState): boolean {
  return (TRANSITIONS[from] || []).includes(to)
}

export function assertBotTransition(from: BotState, to: BotState): void {
  if (!canBotTransition(from, to)) throw new Error(`Illegal bot transition ${from} -> ${to}`)
}

export function detectMeetingProvider(joinUrl: string): 'zoom' | 'meet' | 'teams' {
  const host = new URL(joinUrl).host.toLowerCase()
  if (host.includes('zoom.us')) return 'zoom'
  if (host === 'meet.google.com') return 'meet'
  if (host.includes('teams.microsoft.com')) return 'teams'
  throw new Error('Unsupported meeting provider')
}

export function pickJoinAdapter(event: CalendarEvent): string {
  return event.provider || detectMeetingProvider(event.joinUrl)
}

export function buildIngestJobInput(event: CalendarEvent, audioBlobId: string) {
  return {
    audioBlobId,
    task: 'meeting' as const,
    source: 'meeting' as const,
    title: event.title,
    options: { speakerLabels: true, timestamps: true },
  }
}
