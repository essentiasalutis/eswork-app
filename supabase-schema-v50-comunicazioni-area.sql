-- ─────────────────────────────────────────────────────────────────────────────
-- v50 — Comunicazioni HR → Essentia Salutis + area (ufficio/reparto) del
--       dipendente + importo ergonomia sulle sessioni di recupero.
--
-- Da applicare in Supabase (SQL editor). Idempotente: si può rilanciare.
-- Ordine sicuro: si può applicare PRIMA o DOPO il deploy del codice. Il codice
-- tollera l'assenza delle colonne/tabella (le funzioni nuove falliscono in modo
-- neutro e la pagina HR mostra "riprova"), quindi nessuna finestra di rottura.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) AREA del dipendente: serve a dare i minuti giusti di ergonomia ai nuovi
--    ingressi (ufficio = postazione individuale; reparto = formazione sulla
--    postazione tipo già studiata). NULL = non indicata (righe preesistenti).
ALTER TABLE public.org_dipendente
  ADD COLUMN IF NOT EXISTS area text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_dipendente_area_check') THEN
    ALTER TABLE public.org_dipendente
      ADD CONSTRAINT org_dipendente_area_check CHECK (area IS NULL OR area IN ('ufficio','reparto'));
  END IF;
END $$;

-- 2) ERGONOMIA dei nuovi ingressi, a consumo, fatta nella stessa visita della
--    sessione di recupero: importo separato da quello della formazione, così
--    il dettaglio resta leggibile.
ALTER TABLE public.org_sessione_formativa
  ADD COLUMN IF NOT EXISTS importo_ergonomia numeric;

-- 3) COMUNICAZIONI dall'HR (canale pubblico token-gated, SOLA SCRITTURA per
--    il testo). L'HR rilegge solo categoria / data / stato delle proprie
--    richieste — MAI il testo: se il link venisse inoltrato o rubato, chi lo
--    apre non legge nulla di scritto a mano. Le risposte di Essentia Salutis
--    sono STRUTTURATE (stato + data), non testo libero.
CREATE TABLE IF NOT EXISTS public.org_comunicazione (
  id               text PRIMARY KEY,
  client_id        text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  categoria        text NOT NULL CHECK (categoria IN ('postazione_nuova','nuovo_ingresso','altro')),
  testo            text NOT NULL CHECK (char_length(testo) BETWEEN 1 AND 1000),
  stato            text NOT NULL DEFAULT 'ricevuta'
                   CHECK (stato IN ('ricevuta','presa_in_carico','programmata','chiusa')),
  data_programmata date,
  letta_at         timestamptz,
  aggiornata_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_comunicazione_client_created
  ON public.org_comunicazione (client_id, created_at DESC);

-- Stesso schema di protezione delle altre tabelle org_ (v37 + v44): RLS attiva,
-- nessuna policy, nessun grant a anon/authenticated → solo il server
-- (service_role) legge e scrive. La anon key è pubblica: un grant qui
-- permetterebbe di leggere o scrivere saltando token e rate-limit.
ALTER TABLE public.org_comunicazione ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.org_comunicazione TO service_role;
REVOKE ALL ON public.org_comunicazione FROM anon, authenticated;

-- Verifica (read-only), dopo l'applicazione:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'org_dipendente' AND column_name = 'area';          -- 1 riga
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'org_sessione_formativa' AND column_name = 'importo_ergonomia'; -- 1 riga
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'org_comunicazione';  -- true
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name = 'org_comunicazione' AND grantee IN ('anon','authenticated'); -- 0 righe
