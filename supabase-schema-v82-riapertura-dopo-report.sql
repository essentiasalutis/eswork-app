-- ============================================================================
-- v82 — Riaprire il check-up dopo il Report di Attivazione
-- ============================================================================
-- Decisione di Enrico (28/9): dopo il Report il check-up si chiude da solo, ma si
-- deve poter riaprire, per esempio quando su 12 dipendenti ne hanno risposto 9 e gli
-- ultimi 3 devono poter compilare. Riaprire fa DECADERE il Report: presentazione e
-- proposta di intervento tornano in bozza finché il Report non si rigenera, e si
-- aggiornano con il nuovo.
--
-- La colonna segna l'ora della riapertura: da lì vale solo un Report generato DOPO
-- (prima valeva quello generato dopo l'avvio del check-up). Le risposte già raccolte
-- restano. Non si riapre un check-up di un'azienda che ha già firmato: il Report è
-- l'Allegato A del contratto.
--
-- Nessun dato personale. Stesse regole di accesso della tabella (solo il server).
-- Idempotente.

ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS riaperto_dopo_report_at timestamptz;

COMMENT ON COLUMN public.assessments.riaperto_dopo_report_at IS
  'Ora della riapertura dopo il Report di Attivazione (v82, 28/9): vale solo un Report generato dopo.';
