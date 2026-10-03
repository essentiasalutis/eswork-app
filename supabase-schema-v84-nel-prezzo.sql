-- ============================================================================
-- v84 — Segno «nel prezzo» sul paziente (Enrico, 4/10)
-- ============================================================================
-- Chi il Report di Attivazione mette nel prezzo: 'level1' (un ciclo di trattamento
-- nell'anno) o 'level2' (un ciclo di prevenzione). Ogni altro ciclo consuma un posto per
-- i nuovi ingressi (lib/posti.mjs): il primo ciclo di chi entra in L1 dopo, ogni secondo
-- ciclo da qualunque strada arrivi, la prevenzione dei neoassunti in L2.
-- Serve un segno fissato al Report perché il livello calcolato cambia: il check-up
-- annuale, le riclassificazioni e la chiusura del ciclo lo riscrivono.
-- Lo scrive la generazione del Report finché l'azienda non ha firmato; dopo la firma non
-- si riscrive. Mai ai neoassunti. Dominio clinico: nessun collegamento all'anagrafica.
-- Senza questa migration il contatore ripiega sul livello calcolato di oggi.
-- ============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nel_prezzo text CHECK (nel_prezzo IN ('level1', 'level2'));

COMMENT ON COLUMN public.patients.nel_prezzo IS
  'Livello con cui il Report di Attivazione ha messo la persona nel prezzo (v84). Fissato alla firma.';
