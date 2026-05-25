-- ============================================================
-- supabase-schema-v14-employee-osteopath.sql
-- Tabelle per UI dipendenti e osteopati (PROMPT 2)
-- DA ESEGUIRE: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Pre-validazioni (videocall osteopata → conferma L1)
CREATE TABLE IF NOT EXISTS public.pre_validations (
  id                    TEXT PRIMARY KEY,
  patient_id            TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id       TEXT REFERENCES public.professionals(id),
  client_id             TEXT REFERENCES public.clients(id),
  duration_minutes      INTEGER,
  nrs_during_call       INTEGER CHECK (nrs_during_call >= 0 AND nrs_during_call <= 10),
  pain_zone             TEXT,
  symptom_duration_months INTEGER,
  clinical_notes        TEXT,
  outcome               TEXT CHECK (outcome IN ('l1_confirmed','not_l1','needs_more_info')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mini-check T3/T6 (compilati dal dipendente)
CREATE TABLE IF NOT EXISTS public.mini_checks (
  id               TEXT PRIMARY KEY,
  patient_id       TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id        TEXT REFERENCES public.clients(id),
  check_type       TEXT NOT NULL DEFAULT 't3' CHECK (check_type IN ('t3','t6')),
  nrs_current      INTEGER CHECK (nrs_current >= 0 AND nrs_current <= 10),
  has_limitations  BOOLEAN,
  wants_contact    BOOLEAN,
  free_text        TEXT,
  triage_outcome   TEXT NOT NULL DEFAULT 'ok' CHECK (triage_outcome IN ('ok','needs_contact')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Re-assessment T12 con PGIC
CREATE TABLE IF NOT EXISTS public.reassessments_t12 (
  id              TEXT PRIMARY KEY,
  patient_id      TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id       TEXT REFERENCES public.clients(id),
  nmq_data        JSONB,
  pgic            INTEGER CHECK (pgic >= 1 AND pgic <= 5),
  computed_level  TEXT CHECK (computed_level IN ('level1','level2','level3')),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_pre_validations_patient ON public.pre_validations(patient_id);
CREATE INDEX IF NOT EXISTS idx_mini_checks_patient ON public.mini_checks(patient_id);
CREATE INDEX IF NOT EXISTS idx_mini_checks_client ON public.mini_checks(client_id);
CREATE INDEX IF NOT EXISTS idx_reassessments_t12_patient ON public.reassessments_t12(patient_id);

-- GRANT
GRANT ALL ON public.pre_validations TO service_role;
GRANT ALL ON public.mini_checks TO service_role;
GRANT ALL ON public.reassessments_t12 TO service_role;
