-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v40-formazione-delta.sql
-- DELTA della feature formazione/turnover (già live, commit 0b2e37b, v37).
-- NON ricostruisce nulla: le tabelle org_* e i dipendenti esistenti restano INTATTI.
-- Tre cose:
--   1. parametri formativi in pricing_settings (v2), editabili da Listino v2;
--   2. hook parte-2 (clinica neoassunto): SOLO un flag di stato, MAI un legame;
--   3. accesso HR: token per-azienda REVOCABILE (l'INSERT resta server-side).
--
-- COME ESEGUIRE: incolla nel SQL Editor di Supabase ed esegui. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Parametri formativi in pricing_settings (v2) ─────────────────────────
-- Nomi ALLINEATI agli esistenti (clients.listino_concentrata / listino_base_completa)
-- per evitare disallineamenti "due nomi per lo stesso concetto".
-- Precedenza in lettura (lib/org.js): override per-azienda (clients.listino_*)
--   → pricing_settings → default del codice. Nessuna regressione sui dati esistenti.
INSERT INTO public.pricing_settings (version, key, value) VALUES
  ('v2','listino_concentrata','350'),
  ('v2','listino_base_completa','500'),
  ('v2','finestra_recupero_mesi','6'),
  ('v2','soglia_recupero_fasce','[{"max":50,"soglia":5},{"max":200,"soglia":10},{"max":null,"soglia":20}]')
ON CONFLICT (version, key) DO NOTHING;

-- ── 2. Hook parte-2 (clinica neoassunto): flag PURO, nessun legame clinico ────
-- MAI patient_id / assessment_id / FK verso il clinico. Il ricongiungimento
-- anagrafica ↔ paziente resta impossibile per costruzione (regola del token, Blocco 2).
-- Questo è solo lo stato dell'invito: non_invitato | invitato | completato.
ALTER TABLE public.org_dipendente
  ADD COLUMN IF NOT EXISTS stato_invito_assessment text
  CHECK (stato_invito_assessment IN ('non_invitato','invitato','completato'));

-- ── 3. Accesso HR: token per-azienda REVOCABILE ─────────────────────────────
-- rigenera = nuovo valore; revoca = NULL (chiude il link). L'inserimento HR passa
-- da un endpoint server che risolve il token (rate-limited, no-return, azienda_id +
-- inserito_da='hr' FORZATI dal token). NESSUN grant anon su org_dipendente: la anon
-- key è pubblica, un grant aprirebbe INSERT diretti a Supabase bypassando token e
-- rate-limit. La RLS resta il guardiano REALE della LETTURA (SELECT anon negato,
-- REVOKE esistente non toccato); HR non ha alcun canale di lettura.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS hr_ingressi_token text UNIQUE;

-- ── Verifica post-esecuzione ─────────────────────────────────────────────────
-- SELECT COUNT(*) FROM public.pricing_settings WHERE key IN
--   ('listino_concentrata','listino_base_completa','finestra_recupero_mesi','soglia_recupero_fasce'); -- → 4
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='org_dipendente' AND column_name='stato_invito_assessment';   -- → 1 riga
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='clients' AND column_name='hr_ingressi_token';                 -- → 1 riga
