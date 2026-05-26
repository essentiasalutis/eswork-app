-- ============================================================
-- supabase-schema-v17-self-declaration.sql
-- Modello Auto-dichiarazione Dipendente (GDPR-compliant)
-- DA ESEGUIRE: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Codice assessment per-cliente (link generico permanente)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assessment_share_code TEXT UNIQUE;

-- Genera codice per clienti esistenti
UPDATE public.clients
SET assessment_share_code = lower(
  substr(md5(id || 'eswork' || now()::text), 1, 6)
)
WHERE assessment_share_code IS NULL;

-- 2. Campi auto-dichiarazione su patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS self_declared    BOOLEAN DEFAULT FALSE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS wants_to_be_contacted BOOLEAN DEFAULT TRUE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS phone            TEXT;

-- 3. Indici
CREATE INDEX IF NOT EXISTS idx_clients_assessment_share_code ON public.clients(assessment_share_code);
CREATE INDEX IF NOT EXISTS idx_patients_self_declared ON public.patients(self_declared);
CREATE INDEX IF NOT EXISTS idx_patients_wants_contact ON public.patients(wants_to_be_contacted);

GRANT ALL ON public.clients TO service_role;
GRANT ALL ON public.patients TO service_role;
