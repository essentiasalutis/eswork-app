-- ES Work — Schema v20
-- Chiusura ciclo unificata: nessun ciclo si chiude senza PGIC.
--
-- Nuovo stato intermedio 'pending_pgic': il ciclo raggiunge la 4ª sessione (o l'osteopata
-- segnala l'esito) ma resta APERTO finché non viene registrato il PGIC. Solo allora → 'closed'.

ALTER TABLE public.treatment_cycles DROP CONSTRAINT IF EXISTS treatment_cycles_status_check;
ALTER TABLE public.treatment_cycles ADD CONSTRAINT treatment_cycles_status_check
  CHECK (status IN ('active','pending_pgic','closed'));
