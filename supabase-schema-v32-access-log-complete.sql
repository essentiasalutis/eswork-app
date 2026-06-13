-- ─── ES Work — Schema v32: Registro accessi completo e consultabile ──────────
-- BLOCCO 3: audit trail clinico tracciabile e privacy-compliant.
--   • patient_id  → collega l'accesso al paziente reale (non più stringa libera)
--   • ip_hash     → IP del professionista ANONIMIZZATO (mai più in chiaro)
--   • user_agent  → contesto tecnico dell'accesso
-- La colonna `ip` (in chiaro) resta solo per compatibilità storica: il codice
-- NON la scrive più. Idempotente.

ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL;

ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

ALTER TABLE public.access_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_access_logs_patient ON public.access_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_professional ON public.access_logs(professional_id);
