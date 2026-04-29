-- ES Work — Schema v2 (eseguire dopo supabase-schema.sql)
-- Dashboard → SQL Editor → New Query → incolla → Run

-- ─── Nuove colonne su clients (pipeline + telefono + fonte) ──────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS contact_phone  text,
  ADD COLUMN IF NOT EXISTS source         text DEFAULT 'passaparola',
  ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'contacted',
  ADD COLUMN IF NOT EXISTS pipeline_notes text,
  ADD COLUMN IF NOT EXISTS last_contact_date timestamptz;

-- ─── Tabella primo colloquio ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS first_meetings (
  id                  text primary key,
  client_id           text not null references clients(id) on delete cascade,
  -- Sezione A
  employees           integer,
  sector              integer,
  max_people_training integer,
  num_locations       integer,
  -- Sezione B
  absence_days        integer,
  turnover            integer,
  remote_work         text,
  work_shifts         text,
  internal_contact    text,
  -- Sezione C
  motivation          text,
  -- Sezione E
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

ALTER TABLE first_meetings DISABLE ROW LEVEL SECURITY;
