// claude-local adapter — routes LLM work through the LOCAL Claude Code CLI
// (no hosted API), per the project's LLM-access rule. Prompt goes in via
// stdin to avoid argv size limits on long transcripts.
import { spawn } from 'node:child_process'
import { assemblePrompt, type LlmAdapter } from '../index.ts'

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude'
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 180_000)

export class ClaudeLocalAdapter implements LlmAdapter {
  readonly name = 'claude-local'

  run(taskPrompt: string, transcriptContext: string): Promise<string> {
    const prompt = assemblePrompt(taskPrompt, transcriptContext)
    return new Promise((resolve, reject) => {
      // -p: print mode (non-interactive). Best available model by default —
      // no silent downgrades (project rule).
      const child = spawn(CLAUDE_BIN, ['-p', '--output-format', 'text'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      let out = ''
      let err = ''
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`claude-local timed out after ${TIMEOUT_MS}ms`))
      }, TIMEOUT_MS)

      child.stdout.on('data', d => { out += d })
      child.stderr.on('data', d => { err += d })
      child.on('error', e => {
        clearTimeout(timer)
        reject(new Error(`claude-local failed to start (${CLAUDE_BIN}): ${e.message}`))
      })
      child.on('close', code => {
        clearTimeout(timer)
        if (code !== 0) return reject(new Error(`claude-local exited ${code}: ${err.slice(0, 500)}`))
        const text = out.trim()
        if (!text) return reject(new Error('claude-local returned empty output'))
        resolve(text)
      })
      child.stdin.write(prompt)
      child.stdin.end()
    })
  }
}
