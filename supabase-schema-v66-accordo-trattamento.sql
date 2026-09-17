-- ============================================================================
-- v66 — Accordo sul trattamento dei dati del professionista (punto c)
-- ============================================================================
-- Decisioni di Enrico (17/9):
--   · senza accordo sottoscritto il professionista NON è conforme: non gli si
--     assegnano aziende e non prende in carico nuovi pazienti;
--   · servono DUE atti: la SPUNTA del professionista (prova l'atto: chi, quando,
--     su quale versione) e il FILE firmato (prova il contenuto);
--   · il testo sta nell'ARCHIVIO (v64), codice 'accordo_trattamento_dati'; lo
--     scrive l'avvocato e si pubblica con una migration a parte. Il requisito vale
--     DA SUBITO: finché il testo non c'è, nessuno è conforme per l'accordo;
--   · nuova versione: va risottoscritta, con 7 giorni di preavviso;
--   · l'admin può caricare il file (con la dicitura), la spunta resta del
--     professionista.
--
-- Qui:
--   · la SPUNTA non ha una tabella propria: è una riga di consensi_registrati
--     (soggetto_tipo 'professionista', codice 'accordo_trattamento_dati'),
--     già solo in aggiunta per la v64;
--   · i FILE firmati stanno in accordi_trattamento_file: solo in aggiunta, nessuna
--     modifica e nessuna cancellazione. Un nuovo caricamento è una riga nuova, il
--     file precedente resta: serve a dimostrare quale accordo valeva quando un dato
--     è stato trattato.
--
-- Dipende da v64. Idempotente.

CREATE TABLE IF NOT EXISTS public.accordi_trattamento_file (
  id               TEXT PRIMARY KEY,
  professional_id  TEXT NOT NULL,                 -- senza FK: la prova resta anche se il professionista viene rimosso
  testo_legale_id  TEXT NOT NULL REFERENCES public.testi_legali(id),
  versione         TEXT NOT NULL,
  file_path        TEXT NOT NULL,                 -- bucket privato pro-documents
  file_mime        TEXT NOT NULL CHECK (file_mime IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_bytes       INTEGER NOT NULL CHECK (file_bytes > 0),
  file_impronta    TEXT NOT NULL,                 -- SHA-256 calcolato dal SERVER
  caricato_da      TEXT NOT NULL,                 -- 'professionista' | 'admin:<email>'
  caricato_il      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accordi_file_pro ON public.accordi_trattamento_file(professional_id);

-- La versione indicata deve essere un testo PUBBLICATO dell'accordo (non una bozza,
-- non un altro documento).
CREATE OR REPLACE FUNCTION public.accordi_file_versione_valida() RETURNS trigger AS $f$
DECLARE t RECORD;
BEGIN
  SELECT codice, versione, stato INTO t FROM public.testi_legali WHERE id = NEW.testo_legale_id;
  IF t.codice IS DISTINCT FROM 'accordo_trattamento_dati' THEN
    RAISE EXCEPTION 'accordi_trattamento_file: il testo % non è l''accordo sul trattamento dei dati', NEW.testo_legale_id;
  END IF;
  IF t.stato = 'bozza' THEN
    RAISE EXCEPTION 'accordi_trattamento_file: la versione % è una bozza', t.versione;
  END IF;
  IF NEW.versione IS DISTINCT FROM t.versione THEN
    RAISE EXCEPTION 'accordi_trattamento_file: versione % diversa da quella del testo (%)', NEW.versione, t.versione;
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accordi_file_versione_trg ON public.accordi_trattamento_file;
CREATE TRIGGER accordi_file_versione_trg BEFORE INSERT ON public.accordi_trattamento_file
  FOR EACH ROW EXECUTE FUNCTION public.accordi_file_versione_valida();

CREATE OR REPLACE FUNCTION public.accordi_file_solo_aggiunta() RETURNS trigger AS $f$
BEGIN
  RAISE EXCEPTION 'accordi_trattamento_file: solo in aggiunta (un nuovo caricamento è una riga nuova)';
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accordi_file_solo_aggiunta_trg ON public.accordi_trattamento_file;
CREATE TRIGGER accordi_file_solo_aggiunta_trg BEFORE UPDATE OR DELETE ON public.accordi_trattamento_file
  FOR EACH ROW EXECUTE FUNCTION public.accordi_file_solo_aggiunta();

ALTER TABLE public.accordi_trattamento_file ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accordi_trattamento_file FROM anon, authenticated;
GRANT ALL ON public.accordi_trattamento_file TO service_role;

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT count(*) FROM public.accordi_trattamento_file;          -- 0
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.accordi_trattamento_file'::regclass AND NOT tgisinternal;
