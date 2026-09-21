-- ============================================================================
-- v75 — Prezzo applicato più basso del calcolato (sconto sull'Anno 1)
-- ============================================================================
-- Decisioni di Enrico (21/9), sullo schema dello sforamento (v63):
--   · prezzo Anno 1 più basso del calcolato (dopo il tetto), con MOTIVAZIONE
--     obbligatoria registrata; il cliente vede solo il totale finale;
--   · margine = (prezzo applicato − costo Anno 1) / prezzo applicato, sul costo
--     TOTALE (professionisti + 30% della quota);
--   · sotto la soglia del Listino (40%): avviso e conferma; sotto zero: RIFIUTATO,
--     senza eccezioni (anche qui sotto, seconda difesa);
--   · vale per UN anno: il rinnovo resta al prezzo pieno (registrato qui per la
--     vista amministratore);
--   · modificabile fino al Report di Attivazione, poi copiato nel report e fermo;
--   · ogni registrazione o revoca si aggiunge allo storico, che non si cancella.
--
-- Il tetto (promessa della forbice) NON si blocca: se porta un'azienda sotto la
-- soglia, si registra un AVVISO DI REVISIONE dei parametri della forbice
-- (forbice_revisioni), perché è la prova che per quel settore sono troppo bassi.
-- Dipende da v73 (funzione mc_e_demo). Idempotente.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sconto_prezzo_applicato  INTEGER,        -- € Anno 1 proposto al cliente
  ADD COLUMN IF NOT EXISTS sconto_calcolato         INTEGER,        -- € Anno 1 prima dello sconto (dopo il tetto)
  ADD COLUMN IF NOT EXISTS sconto_costo             INTEGER,        -- € costo Anno 1 (professionisti + quota)
  ADD COLUMN IF NOT EXISTS sconto_margine_pct       NUMERIC(6,2),   -- margine risultante, in %
  ADD COLUMN IF NOT EXISTS sconto_rinnovo_pieno     INTEGER,        -- € Anno 2 a prezzo pieno, per la vista admin
  ADD COLUMN IF NOT EXISTS sconto_conferma_margine  BOOLEAN,        -- conferma data sotto la soglia di avviso
  ADD COLUMN IF NOT EXISTS sconto_motivo            TEXT,
  ADD COLUMN IF NOT EXISTS sconto_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sconto_storico           JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seconda difesa: mai sotto il costo, sempre più basso del calcolato, sempre motivato.
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_sconto_valido;
ALTER TABLE public.clients ADD CONSTRAINT clients_sconto_valido CHECK (
  sconto_prezzo_applicato IS NULL OR (
        sconto_calcolato IS NOT NULL AND sconto_costo IS NOT NULL
    AND sconto_prezzo_applicato > 0
    AND sconto_prezzo_applicato <  sconto_calcolato
    AND sconto_prezzo_applicato >= sconto_costo
    AND length(trim(COALESCE(sconto_motivo, ''))) >= 15
  )
);

-- Lo storico si allunga soltanto: nessuna voce si toglie o si riscrive.
CREATE OR REPLACE FUNCTION public.clients_sconto_storico_solo_aggiunta() RETURNS trigger AS $f$
DECLARE
  vecchio JSONB := COALESCE(OLD.sconto_storico, '[]'::jsonb);
  nuovo   JSONB := COALESCE(NEW.sconto_storico, '[]'::jsonb);
  i       INTEGER;
BEGIN
  IF jsonb_array_length(nuovo) < jsonb_array_length(vecchio) THEN
    RAISE EXCEPTION 'clients.sconto_storico: lo storico degli sconti si allunga soltanto';
  END IF;
  FOR i IN 0 .. jsonb_array_length(vecchio) - 1 LOOP
    IF (nuovo -> i) IS DISTINCT FROM (vecchio -> i) THEN
      RAISE EXCEPTION 'clients.sconto_storico: una voce dello storico non si riscrive';
    END IF;
  END LOOP;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_sconto_storico_trg ON public.clients;
CREATE TRIGGER clients_sconto_storico_trg BEFORE UPDATE OF sconto_storico ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_sconto_storico_solo_aggiunta();

COMMENT ON COLUMN public.clients.sconto_motivo IS
  'Motivazione interna del prezzo Anno 1 più basso del calcolato. MAI mostrata al cliente.';

-- ─── Avvisi di revisione dei parametri della forbice ────────────────────────
CREATE TABLE IF NOT EXISTS public.forbice_revisioni (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL,                 -- senza FK: l'avviso resta
  settore       TEXT,
  dipendenti    INTEGER,
  calcolato     INTEGER NOT NULL,              -- € Anno 1 dal motore
  massimo       INTEGER NOT NULL,              -- € massimo della forbice (prezzo applicato dal tetto)
  costo         INTEGER NOT NULL,              -- € costo Anno 1
  margine_pct   NUMERIC(6,2) NOT NULL,
  soglia_pct    NUMERIC(6,2) NOT NULL,
  fonte         TEXT NOT NULL CHECK (fonte IN ('offerta', 'report')),
  creato_il     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_forbice_revisioni ON public.forbice_revisioni(client_id, fonte, calcolato, massimo);

-- Si cancella solo un avviso di un'azienda demo ancora esistente (prove), come in v73.
CREATE OR REPLACE FUNCTION public.forbice_revisioni_solo_aggiunta() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' AND public.mc_e_demo(OLD.client_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'forbice_revisioni: un avviso non si modifica né si cancella';
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS forbice_revisioni_trg ON public.forbice_revisioni;
CREATE TRIGGER forbice_revisioni_trg BEFORE UPDATE OR DELETE ON public.forbice_revisioni
  FOR EACH ROW EXECUTE FUNCTION public.forbice_revisioni_solo_aggiunta();

ALTER TABLE public.forbice_revisioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.forbice_revisioni FROM anon, authenticated;
GRANT ALL ON public.forbice_revisioni TO service_role;

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'clients' AND column_name LIKE 'sconto_%';  -- 9
-- SELECT count(*) FROM public.forbice_revisioni;  -- 0
