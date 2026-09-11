-- ─────────────────────────────────────────────────────────────────────────────
-- v51 — Check-up: scadenza, ora di chiusura, solleciti al referente.
--
-- Da applicare in Supabase (SQL editor). Idempotente: si può rilanciare.
-- Ordine sicuro: PRIMA o DOPO il deploy. Senza queste colonne il codice funziona
-- lo stesso (la chiusura vera vale già sui check-up chiusi a mano); con queste
-- colonne si attivano scadenza, grazia dopo chiusura a mano, proroga e solleciti.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ultimo giorno di apertura: il check-up chiude alle 23:59 (ora italiana) di quel giorno.
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS chiude_il date;

-- Ora della chiusura a mano: serve alla grazia di 30 minuti per chi stava compilando.
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS chiuso_at timestamptz;

-- Solleciti al referente già fatti (a metà finestra / ultimi due giorni):
-- quando è registrato, il promemoria sparisce dalla dashboard.
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS sollecito_meta_at timestamptz;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS sollecito_finale_at timestamptz;

-- Verifica (read-only), dopo l'applicazione — 4 righe:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'assessments'
--      AND column_name IN ('chiude_il','chiuso_at','sollecito_meta_at','sollecito_finale_at');
