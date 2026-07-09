# Pipeline Service — Contract

Pure routing functions between Whisper STT and the LLM. No I/O, no state.

- `needsLlm(task, options) -> boolean` — plain `transcription` (without
  `speakerLabels`/`polish`) never calls the LLM; every other task does.
- `renderPlainTranscript(whisper, options) -> string` — pure-Whisper output;
  `options.timestamps` prefixes `[mm:ss]` per segment. Empty audio →
  `[No speech detected]`.
- `buildTranscriptContext(task, whisper) -> string` — transcript block appended
  to the LLM task prompt. Timing tasks (`subtitles`, `captions`, `chapters`,
  `diarization`, `interview`, `legal`, `lyrics`) get `[HH:MM:SS.mmm --> …]`
  segment lines; others get plain text.
- `formatTimestamp(seconds) -> "HH:MM:SS.mmm"`.

Consumed by `services/jobs` (worker) and `services/api` (sync path).
