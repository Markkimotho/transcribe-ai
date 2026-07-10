# LLM Service — Contract

Swappable text-task engine. The ONLY place semaje talks to an LLM.
The LLM only ever sees transcript text — never audio.

```ts
getLlm(name?: string): LlmAdapter          // name defaults to env LLM_ADAPTER, then 'ollama'
LlmAdapter.run(taskPrompt, transcriptContext): Promise<string>
```

## Adapters

| Adapter | Engine | Notes |
|---|---|---|
| `ollama` (default) | Ollama HTTP API | Fully local, retry x3, model and endpoint configurable per workspace. |
| `llama-cpp` | llama.cpp OpenAI-compatible server | Fully local GGUF runtime. |
| `claude-local` | Local Claude Code CLI (`claude -p`, stdin) | Optional local CLI adapter. |
| `gemini` | Gemini HTTP API | Fallback. Needs `GEMINI_API_KEY`. 429 retry ×3. |

`claude-local` becomes the active default only after `npm run eval:llm` passes all
15 task rubrics for it (see `evals/eval_tasks.ts`). Until then deployments pin
`LLM_ADAPTER=gemini`. Strict local mode never selects it as a fallback.

Meeting enrichment is validated as structured JSON containing summary,
decisions, action items with owners/dates, risks, follow-ups, and chapters.
Malformed model output receives one repair pass before the job fails safely.

Task prompts come from `src/utils/promptBuilder.js` (the 15-task prompt library);
transcript context from `services/pipeline`.
