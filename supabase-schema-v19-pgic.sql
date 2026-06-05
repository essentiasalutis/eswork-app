-- ES Work — Schema v19
-- BLOCCO B / PGIC: aggiunge la rilevazione PGIC dove manca.
--
-- PGIC = Patient Global Impression of Change, scala 1-5 (coerente con reassessments_t12):
--   1 = molto peggiorato · 2 = peggiorato · 3 = invariato · 4 = migliorato · 5 = molto migliorato
--
-- mini_checks.nrs_current resta in tabella (storico/non distruttivo) ma NON è più
-- raccolto dal dipendente: il mini-check usa PGIC come misura principale.

ALTER TABLE public.mini_checks      ADD COLUMN IF NOT EXISTS pgic INTEGER CHECK (pgic >= 1 AND pgic <= 5);
ALTER TABLE public.treatment_cycles ADD COLUMN IF NOT EXISTS pgic INTEGER CHECK (pgic >= 1 AND pgic <= 5);

-- BLOCCO B / B3 — assegnazione per-paziente (Livello B).
-- Colonna richiesta dal controllo accessi: l'osteopata che effettua la pre-validazione
-- diventa l'assegnatario del paziente. (Dichiarata in vecchi schemi ma mai applicata al DB.)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS assigned_professional_id TEXT REFERENCES public.professionals(id);
CREATE INDEX IF NOT EXISTS idx_patients_assigned_pro ON public.patients(assigned_professional_id);
