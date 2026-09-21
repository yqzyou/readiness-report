-- readiness-report storage schema.
-- Run once against the production database (e.g. Neon SQL editor):
--   psql "$POSTGRES_URL" -f db/schema.sql
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
