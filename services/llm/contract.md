# LLM Service — Contract

Swappable text-task engine. The ONLY place semaje talks to an LLM.
The LLM only ever sees transcript text — never audio.

```ts
getLlm(name?: string): LlmAdapter          // name defaults to env LLM_ADAPTER, then 'claude-local'
LlmAdapter.run(taskPrompt, transcriptContext): Promise<string>
```

## Adapters

| Adapter | Engine | Notes |
|---|---|---|
| `claude-local` (default) | Local Claude Code CLI (`claude -p`, stdin) | No hosted API. Needs the `claude` CLI + creds (`CLAUDE_BIN` overridable). Best available model, no downgrades. |
| `gemini` | Gemini HTTP API | Fallback. Needs `GEMINI_API_KEY`. 429 retry ×3. |

`claude-local` becomes the active default only after `npm run eval:llm` passes all
15 task rubrics for it (see `evals/eval_tasks.ts`). Until then deployments pin
`LLM_ADAPTER=gemini`.

Task prompts come from `src/utils/promptBuilder.js` (the 15-task prompt library);
transcript context from `services/pipeline`.
