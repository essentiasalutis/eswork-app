-- ============================================================================
-- v85 — Da dove viene il segno «nel prezzo» (Enrico, 4/10)
-- ============================================================================
-- Il segno della v84 lo scrive di norma il Report di Attivazione ('report'). Per le aziende
-- che avevano già un Report lo scrive una volta lo script
-- scripts/una-tantum/segna-nel-prezzo.mjs, ricostruendolo:
--   'ricostruito_livello' — dal livello del check-up, ancora intatto (Weisoft, Meccanica);
--   'ricostruito_tracce'  — dalle tracce rimaste, dove il check-up annuale aveva riscritto
--                           il livello (Officine demo).
-- I segni ricostruiti devono restare riconoscibili nel tempo, con la loro data.
-- ============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nel_prezzo_origine text
    CHECK (nel_prezzo_origine IN ('report', 'ricostruito_livello', 'ricostruito_tracce')),
  ADD COLUMN IF NOT EXISTS nel_prezzo_il timestamptz;

COMMENT ON COLUMN public.patients.nel_prezzo_origine IS
  'Chi ha scritto il segno nel_prezzo: il Report di Attivazione o lo script di ricostruzione (v85).';
