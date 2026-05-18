-- ─── v11: Ri-stratificazione ──────────────────────────────────────────────────
-- Aggiunge care_token ai pazienti + tabelle per alert e checkpoint

-- 1. care_token su patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS care_token TEXT UNIQUE;

-- 2. Tabella alert ri-stratificazione
CREATE TABLE IF NOT EXISTS restratification_alerts (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT REFERENCES patients(id) ON DELETE CASCADE,
  client_id   TEXT REFERENCES clients(id) ON DELETE CASCADE,
  source      TEXT NOT NULL CHECK (source IN ('self_trigger', 'checkpoint', 'osteopath')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed_l1', 'not_confirmed')),
  form_data   JSONB,
  session_id  TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS restratification_alerts_client_id_idx
  ON restratification_alerts(client_id);
CREATE INDEX IF NOT EXISTS restratification_alerts_patient_id_idx
  ON restratification_alerts(patient_id);

GRANT ALL ON restratification_alerts TO service_role;

-- 3. Tabella checkpoint
CREATE TABLE IF NOT EXISTS checkpoints (
  id              TEXT PRIMARY KEY,
  patient_id      TEXT REFERENCES patients(id) ON DELETE CASCADE,
  client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('t3', 't6')),
  nrs             INT,
  nrs_baseline    INT,
  pain_zones      JSONB,
  has_limitations BOOLEAN,
  wants_contact   BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checkpoints_client_id_idx
  ON checkpoints(client_id);
CREATE INDEX IF NOT EXISTS checkpoints_patient_id_idx
  ON checkpoints(patient_id);

GRANT ALL ON checkpoints TO service_role;
