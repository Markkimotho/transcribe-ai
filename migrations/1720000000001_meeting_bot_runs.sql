CREATE TABLE IF NOT EXISTS meeting_bot_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  calendar_event_id text NOT NULL DEFAULT '',
  provider    text NOT NULL CHECK (provider IN ('zoom','meet','teams')),
  join_url    text NOT NULL,
  state       text NOT NULL DEFAULT 'invited' CHECK (state IN ('invited','joined','recording','left','failed')),
  job_id      uuid REFERENCES jobs(id) ON DELETE SET NULL,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
