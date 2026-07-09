-- semaje initial schema — multi-tenant from day one.
-- Single-user deploys seed exactly one org + user (see services/auth/src/seed.ts).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE orgs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'self-host',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE TABLE workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audio_blobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES users(id),
  storage_key text NOT NULL,
  bucket      text,
  mime_type   text NOT NULL,
  size_bytes  bigint NOT NULL DEFAULT 0,
  checksum    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transcripts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  owner_id      uuid NOT NULL REFERENCES users(id),
  title         text NOT NULL DEFAULT 'Untitled',
  source        text NOT NULL CHECK (source IN ('upload','live','meeting','dictation')),
  task          text NOT NULL DEFAULT 'transcription',
  language      text,
  duration_sec  double precision,
  text          text NOT NULL DEFAULT '',
  segments      jsonb,
  result        jsonb,
  audio_blob_id uuid REFERENCES audio_blobs(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'complete' CHECK (status IN ('draft','complete')),
  search_tsv    tsvector GENERATED ALWAYS AS (
                  setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
                  setweight(to_tsvector('simple', left(coalesce(text,''), 500000)), 'B')
                ) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transcripts_org_created_idx ON transcripts (org_id, created_at DESC);
CREATE INDEX transcripts_search_idx ON transcripts USING GIN (search_tsv);

CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES users(id),
  type          text NOT NULL DEFAULT 'transcribe',
  status        text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  input         jsonb NOT NULL,
  transcript_id uuid REFERENCES transcripts(id) ON DELETE SET NULL,
  error         text,
  attempts      int NOT NULL DEFAULT 0,
  progress      int NOT NULL DEFAULT 0,
  webhook_url   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);
CREATE INDEX jobs_org_created_idx ON jobs (org_id, created_at DESC);

CREATE TABLE api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  owner_id        uuid NOT NULL REFERENCES users(id),
  name            text NOT NULL,
  key_prefix      text NOT NULL UNIQUE,
  key_hash        text NOT NULL,
  scopes          text[] NOT NULL DEFAULT '{transcribe,read}',
  rate_limit_tier text NOT NULL DEFAULT 'standard',
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shares (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id       uuid NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  kind                text NOT NULL DEFAULT 'link' CHECK (kind IN ('link','user')),
  shared_with_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token               text UNIQUE,
  permission          text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','comment')),
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  url         text NOT NULL,
  secret_hash text NOT NULL,
  events      text[] NOT NULL DEFAULT '{job.succeeded,job.failed}',
  disabled_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,
  transcript_id uuid REFERENCES transcripts(id) ON DELETE SET NULL,
  duration_sec  double precision NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_org_created_idx ON usage_events (org_id, created_at DESC);

CREATE TABLE invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meeting_bot_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  calendar_event_id text NOT NULL,
  provider    text NOT NULL CHECK (provider IN ('zoom','meet','teams')),
  join_url    text NOT NULL,
  state       text NOT NULL DEFAULT 'invited' CHECK (state IN ('invited','joined','recording','left','failed')),
  job_id      uuid REFERENCES jobs(id) ON DELETE SET NULL,
  transcript_id uuid REFERENCES transcripts(id) ON DELETE SET NULL,
  error       text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
