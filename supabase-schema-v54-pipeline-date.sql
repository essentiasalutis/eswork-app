-- ─────────────────────────────────────────────────────────────────────────────
-- v54 — Pipeline commerciale: data di ricontatto e scadenza dell'offerta.
--
-- Stati (fonte unica nel codice: lib/pipeline.js): Contattato, Colloquio fissato,
-- Stima inviata, Check-up inviato, Report presentato, Offerta aperta, Accettato;
-- a lato Non ora, No, Declinato.
--   ricontatto_il     → obbligatoria per "Non ora" (la impone l'API).
--   offerta_scade_il  → "Offerta aperta": binario A = oggi + giorni del Listino
--                       (default 10); binario B e non deciso = NULL, senza scadenza.
-- In più riallinea i vecchi valori di pipeline_stage ('won'/'active' → 'signed',
-- 'closed' → 'lost'): il codice li legge già così, qui si pulisce il dato.
--
-- Da applicare in Supabase (SQL editor). Idempotente. Ordine sicuro: prima o
-- dopo il deploy (senza queste colonne il codice salva lo stato e avvisa;
-- solo "Non ora" resta bloccato finché la migration non c'è).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ricontatto_il date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS offerta_scade_il date;

UPDATE public.clients SET pipeline_stage = 'signed' WHERE pipeline_stage IN ('won', 'active');
UPDATE public.clients SET pipeline_stage = 'lost'   WHERE pipeline_stage = 'closed';

-- Verifica (read-only) — 2 righe, poi nessun valore vecchio:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'
--    AND column_name IN ('ricontatto_il','offerta_scade_il');
--   SELECT pipeline_stage, count(*) FROM public.clients GROUP BY 1 ORDER BY 1;
