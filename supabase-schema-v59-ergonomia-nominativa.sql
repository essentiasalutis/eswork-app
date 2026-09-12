-- v59 — Ergonomia nominativa (piano ORGANIZZATIVO)
--
-- Finora l'ergonomia non aveva un registro per persona: sul dipendente c'era solo
-- `area` (ufficio/reparto), che serve a dimensionare i minuti, e l'importo finiva
-- sulla sessione di recupero. Chi l'avesse ricevuta, e quando, non era scritto.
-- Ora l'ergonomia usa la stessa macchina della formazione: sessione → partecipazioni.
--
-- VINCOLO (Enrico, 12/9): resta dominio ORGANIZZATIVO. La partecipazione registra
-- presenza e data, nient'altro. Nessun campo per osservazioni sulla persona: quelle
-- sono cliniche e non stanno qui (stesso confine di v37: nessun ponte org ↔ paziente).
--
-- `origine` sulla partecipazione distingue come è stata registrata:
--   'spunta_sessione' → dedotta confermando i presenti di una sessione formativa
--                       (proposta spuntata di default, togliibile con un clic);
--   'intervento'      → registrata a mano come intervento di ergonomia;
--   NULL              → righe precedenti a questa migration (formazione).
-- Serve a non confondere mai una presenza segnata da te con una dedotta dal sistema.

-- 1) I vincoli sui "tipo"/"origine" si ampliano. Il nome del CHECK non è garantito:
--    lo si cerca in pg_constraint invece di indovinarlo (un DROP a vuoto lascerebbe
--    in piedi il vincolo stretto e l'ergonomia verrebbe rifiutata in silenzio).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.org_sessione_formativa'::regclass, 'public.org_partecipazione_formativa'::regclass)
      AND (pg_get_constraintdef(oid) LIKE '%tipo%' OR pg_get_constraintdef(oid) LIKE '%origine%')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE public.org_sessione_formativa
  ADD CONSTRAINT org_sessione_formativa_tipo_check
  CHECK (tipo IN ('base','base_concentrata','aggiornamento','ergonomia'));

ALTER TABLE public.org_sessione_formativa
  ADD CONSTRAINT org_sessione_formativa_origine_check
  CHECK (origine IN ('campagna_aggiornamento','recupero_autonomo','base_anno1','intervento_ergonomia'));

ALTER TABLE public.org_partecipazione_formativa
  ADD CONSTRAINT org_partecipazione_formativa_tipo_check
  CHECK (tipo IN ('base','base_concentrata','aggiornamento','ergonomia'));

-- 2) Come è stata registrata la partecipazione.
ALTER TABLE public.org_partecipazione_formativa
  ADD COLUMN IF NOT EXISTS origine TEXT;

ALTER TABLE public.org_partecipazione_formativa
  DROP CONSTRAINT IF EXISTS org_partecipazione_formativa_origine_check;

ALTER TABLE public.org_partecipazione_formativa
  ADD CONSTRAINT org_partecipazione_formativa_origine_check
  CHECK (origine IS NULL OR origine IN ('spunta_sessione','intervento'));

CREATE INDEX IF NOT EXISTS idx_org_part_tipo ON public.org_partecipazione_formativa(tipo);
