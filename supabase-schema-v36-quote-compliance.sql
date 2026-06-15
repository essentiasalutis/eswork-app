-- ─── ES Work — Schema v36: Conformità preventivo (flag dentro/fuori forbice) ────
-- Persiste, sul Report di Attivazione, la PROVA che il prezzo definitivo (dati reali)
-- rientra nella forbice presentata al colloquio / nella Lettera di incarico (Art. 3).
-- Dato INTERNO (solo admin): generated_reports è già accessibile solo a service_role.
-- quote_compliance = { in_range: bool, min, avg, max, real_price } (€/anno Anno 1).
--
-- RETRO-COMPATIBILE: aggiunge solo una colonna nullable → non rompe dati né codice.
-- Idempotente.

ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS quote_compliance JSONB;
