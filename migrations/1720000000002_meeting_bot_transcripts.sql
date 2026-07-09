ALTER TABLE meeting_bot_runs
  ADD COLUMN IF NOT EXISTS transcript_id uuid REFERENCES transcripts(id) ON DELETE SET NULL;

ALTER TABLE meeting_bot_runs
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

ALTER TABLE meeting_bot_runs
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;
