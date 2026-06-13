-- ─── ES Work — Schema v31: Consenso persistito e provabile ───────────────────
-- BLOCCO 1: rende la prova del consenso completa e riconducibile alla persona.
--   • patient_id          → collega il consenso al paziente (chi ha acconsentito)
--   • informativa_version → quale versione del testo è stata accettata
--   • assessment_id nullable → il consenso resta registrabile anche senza un
--     assessment attivo (è comunque legato al patient_id)
--
-- Idempotente: eseguibile più volte senza errori.

ALTER TABLE public.assessment_consents
  ADD COLUMN IF NOT EXISTS patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.assessment_consents
  ADD COLUMN IF NOT EXISTS informativa_version TEXT;

-- assessment_id non più obbligatorio (il consenso è legato al paziente)
ALTER TABLE public.assessment_consents
  ALTER COLUMN assessment_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_consents_patient
  ON public.assessment_consents(patient_id);
