-- ============================================================
-- supabase-schema-v10-grants.sql
-- Explicit GRANTs per conformità Supabase Data API
-- (cambio effettivo 30 ottobre 2026 per progetti esistenti,
--  30 maggio 2026 per progetti nuovi)
--
-- L'app usa SUPABASE_SERVICE_KEY (service_role) server-side.
-- Aggiunge i grant espliciti su tutte le tabelle per garantire
-- accesso continuo dopo il rollout Supabase.
--
-- DA ESEGUIRE: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── GRANT service_role su tutte le tabelle ────────────────────────────────────
-- service_role è il ruolo usato dal backend via SUPABASE_SERVICE_KEY

GRANT ALL ON public.clients                  TO service_role;
GRANT ALL ON public.assessments              TO service_role;
GRANT ALL ON public.responses                TO service_role;
GRANT ALL ON public.sessions                 TO service_role;
GRANT ALL ON public.patients                 TO service_role;
GRANT ALL ON public.professionals            TO service_role;
GRANT ALL ON public.professional_assignments TO service_role;
GRANT ALL ON public.first_meetings           TO service_role;
GRANT ALL ON public.access_logs              TO service_role;
GRANT ALL ON public.referral_codes           TO service_role;
GRANT ALL ON public.referral_uses            TO service_role;
GRANT ALL ON public.assessment_consents      TO service_role;
GRANT ALL ON public.patient_documents        TO service_role;

-- ── GRANT su tutte le sequences (necessario per INSERT con serial/generated) ──
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ── Default privileges: le tabelle future avranno grant automatico ────────────
-- Così ogni nuova tabella creata in public eredita i permessi senza intervento manuale

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- ── Verifica (opzionale) ──────────────────────────────────────────────────────
-- Esegui questa query per controllare che i grant siano stati applicati:
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee = 'service_role'
-- ORDER BY table_name;
