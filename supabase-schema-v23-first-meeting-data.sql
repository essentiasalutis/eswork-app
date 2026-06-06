-- ES Work — Schema v23
-- Scheda colloquio guidata a 4 step: contenitore unico JSONB per i dati ricchi
-- (contesto, disturbi, logistica, sedi, parametri preventivo). Gli scalari esistenti
-- (employees, sector, absence_days, num_locations) restano popolati per il calcolatore.

ALTER TABLE public.first_meetings ADD COLUMN IF NOT EXISTS data JSONB;
