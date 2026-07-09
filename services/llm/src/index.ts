// ═══════════════════════════════════════════════════════════════
// services/llm — swappable text-task engine behind one contract.
// Adapters: claude-local (default, shells out to local Claude Code)
// and gemini (HTTP fallback). The LLM only ever sees transcript
// text — never audio.
// ═══════════════════════════════════════════════════════════════
import { ClaudeLocalAdapter } from './adapters/claude-local.ts'
import { GeminiAdapter } from './adapters/gemini.ts'

export interface LlmAdapter {
  readonly name: string
  /** Runs the task prompt against the transcript context. Returns the task output text. */
  run(taskPrompt: string, transcriptContext: string): Promise<string>
}

/** Full prompt assembly — shared by every adapter so output is engine-independent. */
export function assemblePrompt(taskPrompt: string, transcriptContext: string): string {
  return `${taskPrompt}\n\n${'═'.repeat(40)}\n\n${transcriptContext}`
}

const adapters: Record<string, () => LlmAdapter> = {
  'claude-local': () => new ClaudeLocalAdapter(),
  'gemini': () => new GeminiAdapter(),
}

let active: LlmAdapter | null = null

export function getLlm(name = process.env.LLM_ADAPTER || 'claude-local'): LlmAdapter {
  if (active && active.name === name) return active
  const make = adapters[name]
  if (!make) {
    throw new Error(`Unknown LLM_ADAPTER=${name}. Use one of: ${Object.keys(adapters).join(', ')}`)
  }
  active = make()
  return active
}

/** Test seam. */
export function _setLlm(a: LlmAdapter | null): void { active = a }
