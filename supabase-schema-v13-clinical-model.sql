-- ============================================================
-- supabase-schema-v13-clinical-model.sql
-- Modello clinico v4: cicli, waitlist, eventi acuti, tier
-- DA ESEGUIRE: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Colonne aggiuntive su patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS computed_level TEXT CHECK (computed_level IN ('level1','level2','level3'));
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS level_status TEXT NOT NULL DEFAULT 'active' CHECK (level_status IN ('active','pending','opted_out'));
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS current_cycle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS last_cycle_end_date TIMESTAMPTZ;

-- Colonna su assessments
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS computed_level TEXT CHECK (computed_level IN ('level1','level2','level3'));

-- Colonna tier su clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'core' CHECK (tier IN ('core','plus','enterprise'));

-- Cicli di trattamento L1
CREATE TABLE IF NOT EXISTS public.treatment_cycles (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id TEXT REFERENCES public.professionals(id),
  cycle_number INTEGER NOT NULL DEFAULT 1,
  sessions_planned INTEGER NOT NULL DEFAULT 4,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  outcome TEXT CHECK (outcome IN ('improved','no_improvement')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Waitlist candidati L1
CREATE TABLE IF NOT EXISTS public.waitlist (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'assessment' CHECK (source IN ('assessment','minicheck','acute_event','restratification')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eventi acuti
CREATE TABLE IF NOT EXISTS public.acute_events (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id TEXT REFERENCES public.professionals(id),
  pain_zone TEXT,
  nrs INTEGER CHECK (nrs >= 0 AND nrs <= 10),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','resolved','escalated')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  escalation_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colonna cycle_id su sessions (opzionale, per collegare sessione a ciclo)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cycle_id TEXT REFERENCES public.treatment_cycles(id) ON DELETE SET NULL;

-- Indici
CREATE INDEX IF NOT EXISTS idx_treatment_cycles_patient ON public.treatment_cycles(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_cycles_client ON public.treatment_cycles(client_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_client ON public.waitlist(client_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist(status);
CREATE INDEX IF NOT EXISTS idx_acute_events_patient ON public.acute_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_acute_events_client ON public.acute_events(client_id);
CREATE INDEX IF NOT EXISTS idx_acute_events_status ON public.acute_events(status);

-- GRANT
GRANT ALL ON public.treatment_cycles TO service_role;
GRANT ALL ON public.waitlist TO service_role;
GRANT ALL ON public.acute_events TO service_role;
