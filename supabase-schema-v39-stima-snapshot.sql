-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v39-stima-snapshot.sql
-- Snapshot Stima→Report (pricing v2): congela parametri + forbice al momento
-- della Stima consegnata (store=true), così un cambio dei parametri globali non
-- sposta retroattivamente la promessa fatta al prospect.
--
-- Colonna SEPARATA da first_meetings.data (che il colloquio riscrive in blocco):
-- niente clobber dall'autosave del colloquio. NULL = nessuna Stima emessa =
-- comportamento live attuale. Nessuna migrazione dati.
--
-- COME ESEGUIRE: incolla nel SQL Editor di Supabase ed esegui. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.first_meetings
  ADD COLUMN IF NOT EXISTS stima_snapshot JSONB;

-- Forma del JSONB (documentazione, non vincolata a schema):
-- {
--   at: <ISO>, pricing_version: 'v2', tipo_prodotto: 'programma_completo'|'pacchetto_prevenzione',
--   inputs:    { n, sector, tier, groups, rates{...}, vatExempt, l2Mult, ergonomia{nUfficio,nPostazioni} },
--   v2Params:  { ...parametri pricing_settings risolti al momento della Stima... },
--   forchetta: { min:{pct,l1,l2,price_y1,price_y2}, avg:{...}, max:{...} } | null,
--   pacchetto_price: <num> | null,
--   frozen_at: <ISO> | null    -- valorizzato alla generazione del Report (catena chiusa)
-- }

-- Verifica:
-- SELECT COUNT(*) FROM public.first_meetings WHERE stima_snapshot IS NOT NULL;  -- atteso: 0 subito dopo
