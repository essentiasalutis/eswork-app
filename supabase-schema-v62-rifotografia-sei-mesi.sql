-- ============================================================================
-- v62 — La ri-fotografia a sei mesi
-- ============================================================================
-- Decisione di Enrico (12/9): a tre mesi il report racconta il movimento con i dati
-- che ci sono; a SEI MESI il questionario torna a tutta la popolazione, così la
-- fotografia è confrontabile con quella di partenza — stessa strumentazione ai due
-- capi, che è l'unico modo perché il confronto regga.
--
-- La rivalutazione a sei mesi usa la STESSA tabella di quella annuale (stesse
-- domande, stesso PGIC): qui si aggiunge solo il momento a cui si riferisce.
-- Le righe già esistenti sono tutte annuali → default 't12'.
--
-- NB: il nome della tabella resta `reassessments_t12` per non rinominare una tabella
-- viva; da qui in avanti contiene due momenti, distinti da `checkpoint`.

ALTER TABLE public.reassessments_t12
  ADD COLUMN IF NOT EXISTS checkpoint TEXT NOT NULL DEFAULT 't12';

ALTER TABLE public.reassessments_t12
  DROP CONSTRAINT IF EXISTS reassessments_t12_checkpoint_check;

ALTER TABLE public.reassessments_t12
  ADD CONSTRAINT reassessments_t12_checkpoint_check CHECK (checkpoint IN ('t6', 't12'));

CREATE INDEX IF NOT EXISTS idx_reassessments_checkpoint
  ON public.reassessments_t12(client_id, checkpoint);
