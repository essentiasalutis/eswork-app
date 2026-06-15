-- ─── ES Work — Schema v35: Slot "Qualifica" (titolo di formazione o albo) ─────
-- Aggiunge il doc_type 'qualification_diploma' (titolo di formazione in osteopatia)
-- accanto ad 'albo': per la conformità ne basta ALMENO UNO (l'albo degli osteopati
-- è ancora in costituzione). 'rc_receipt' resta nell'enum (solo nascosto via flag).
--
-- RETRO-COMPATIBILE: allarga solo l'insieme dei valori ammessi → non rompe i dati
-- né il codice già in produzione (che non inserisce mai il nuovo valore).
-- Idempotente: eseguibile più volte.

ALTER TABLE public.pro_documents DROP CONSTRAINT IF EXISTS pro_documents_doc_type_check;
ALTER TABLE public.pro_documents ADD CONSTRAINT pro_documents_doc_type_check
  CHECK (doc_type IN ('identity','qualification_diploma','albo','rc_policy','rc_receipt','contract'));
