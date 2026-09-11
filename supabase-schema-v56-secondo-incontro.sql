-- ─────────────────────────────────────────────────────────────────────────────
-- v56 — Data del secondo incontro (presentazione del Report di Attivazione).
--
-- Si sceglie nella "Mail di riepilogo" della Stima o nella scheda azienda; entra nella
-- mail ("Ci rivediamo il …") e compare in dashboard in "Questa settimana" come
-- "📊 Presentazione del Report".
--
-- Da applicare in Supabase (SQL editor). Idempotente. Ordine sicuro: prima o dopo il
-- deploy (senza la colonna la mail parte lo stesso, la data non si salva).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS secondo_incontro_il date;

-- Verifica (read-only) — 1 riga:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'
--    AND column_name = 'secondo_incontro_il';
