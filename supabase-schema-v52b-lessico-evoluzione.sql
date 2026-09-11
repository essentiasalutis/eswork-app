-- v52b — seconda occorrenza di "assessment" nel testo di evoluzione del Pacchetto
-- (la v52 correggeva solo la prima frase). Idempotente.
UPDATE public.pricing_settings
   SET value = replace(value, 'valorizzando il lavoro di assessment già svolto', 'valorizzando il check-up già svolto'),
       updated_at = now()
 WHERE version = 'v2' AND key = 'testo_evoluzione_pacchetto'
   AND value LIKE '%il lavoro di assessment già svolto%';

-- Verifica (read-only) — 0 righe:
--   SELECT key FROM public.pricing_settings WHERE version = 'v2' AND value ILIKE '%assessment%';
