-- v57 — Perché un report ha il testo di riserva
-- Il valore si decide PRIMA della chiamata, non nel catch: la distinzione che conta è
-- se i dati sono usciti o no.
--   'ai'              → chiamata fatta, testo dell'AI usato
--   'fallback_no_key' → nessuna chiamata: NESSUN dato uscito
--   'fallback_errore' → chiamata fatta (dati usciti), risposta scartata o non arrivata
-- Non si salva mai il messaggio d'errore tecnico: può contenere frammenti del payload.

ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS ai_status TEXT;
