-- ES Work — Schema v3 (eseguire dopo supabase-schema-v2.sql)
-- Dashboard → SQL Editor → New Query → incolla → Run

-- ─── Professionisti ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professionals (
  id                   text primary key,
  name                 text not null,
  email                text not null unique,
  password_hash        text not null,
  phone                text,
  active               boolean not null default true,
  must_reset_password  boolean not null default false,
  created_at           timestamptz not null default now()
);
ALTER TABLE professionals DISABLE ROW LEVEL SECURITY;

-- ─── Assegnazioni professionista → azienda ────────────────────────────────────
CREATE TABLE IF NOT EXISTS professional_assignments (
  id               text primary key,
  professional_id  text not null references professionals(id) on delete cascade,
  client_id        text not null references clients(id) on delete cascade,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  UNIQUE (professional_id, client_id)
);
ALTER TABLE professional_assignments DISABLE ROW LEVEL SECURITY;

-- ─── Pazienti ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id                       text primary key,
  client_id                text not null references clients(id) on delete cascade,
  first_name               text not null,
  last_name                text not null,
  age                      integer,
  gender                   text,           -- 'M' | 'F'
  job_activity             text,
  sedentary                boolean,
  does_sport               boolean,
  sport_details            text,
  pain_location            text,
  pain_onset               text,
  pain_type                text,
  takes_medications        boolean,
  medications_details      text,
  recent_diagnostics       boolean,
  diagnostics_details      text,
  traumas_surgeries        text,
  vision_issues            boolean,
  hearing_issues           boolean,
  headaches                boolean,
  bruxism                  boolean,
  reflux_gastritis         boolean,
  bowel_regular            boolean,
  cardiovascular_regular   boolean,
  urological_issues        text,
  gynecological_info       text,
  red_flags                boolean,
  red_flags_details        text,
  notes                    text,
  level                    text,           -- 'level1' | 'level2' | 'level3'
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;

-- ─── Sessioni ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                  text primary key,
  patient_id          text not null references patients(id) on delete cascade,
  professional_id     text not null references professionals(id),
  client_id           text not null references clients(id),
  date                timestamptz not null default now(),
  session_number      integer not null default 1,
  nrs_pre             integer,
  nrs_post            integer,
  treatment_notes     text,
  next_session_notes  text,
  closed_at           timestamptz,        -- null = aperta, non null = chiusa (blocco edit)
  created_at          timestamptz not null default now()
);
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;

-- ─── Log accessi ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id               text primary key,
  professional_id  text references professionals(id),
  action           text not null,  -- 'login' | 'logout' | 'view_patient' | 'close_session'
  ip               text,
  details          text,
  created_at       timestamptz not null default now()
);
ALTER TABLE access_logs DISABLE ROW LEVEL SECURITY;
