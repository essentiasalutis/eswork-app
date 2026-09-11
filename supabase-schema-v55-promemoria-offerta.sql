-- ─────────────────────────────────────────────────────────────────────────────
-- v55 — Promemoria a metà validità dell'offerta (punto 8 del funnel).
--
--   offerta_aperta_il     → giorno in cui l'azienda è entrata in "Offerta aperta"
--                           (dalla Pipeline o da "Invia offerta via email"): da qui
--                           si calcola la metà della validità.
--   offerta_sollecito_at  → quando Enrico ha scritto al referente dalla dashboard;
--                           si azzera a ogni nuova apertura dell'offerta.
-- Solo le offerte con una scadenza hanno il promemoria (binario A sempre, B solo se
-- la data è stata messa a mano).
--
-- Da applicare in Supabase (SQL editor). Idempotente. Ordine sicuro: prima o dopo
-- il deploy (senza queste colonne tutto il resto funziona, il promemoria no).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS offerta_aperta_il date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS offerta_sollecito_at timestamptz;

-- Offerte già aperte prima della v55: la metà si conta da oggi.
UPDATE public.clients SET offerta_aperta_il = CURRENT_DATE
 WHERE pipeline_stage = 'offer_open' AND offerta_aperta_il IS NULL;

-- Verifica (read-only) — 2 righe:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'
--    AND column_name IN ('offerta_aperta_il','offerta_sollecito_at');
