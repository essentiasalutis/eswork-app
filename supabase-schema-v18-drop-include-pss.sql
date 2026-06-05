-- ES Work — Schema v18
-- BLOCCO A / A3: rimozione colonna orfana include_pss
--
-- La colonna assessments.include_pss apparteneva al vecchio modello (PSS-10),
-- rimosso in FASE 2. Nessun codice la referenzia più. Pre-lancio: drop pulito.

ALTER TABLE public.assessments DROP COLUMN IF EXISTS include_pss;
