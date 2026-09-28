-- ============================================================================
-- v81 — Riassunti per la presentazione del Report di Attivazione
-- ============================================================================
-- Decisione di Enrico (28/9): la presentazione nasce dal Report di Attivazione e ne
-- riassume le voci (Executive Summary, Mappa Clinica, Piano Operativo Proposto,
-- Raccomandazioni). I riassunti li scrive l'AI nella STESSA chiamata del Report — gli
-- stessi dati, niente in più verso l'esterno — e passano lo stesso controllo
-- automatico. Si salvano qui, accanto al testo: se il Report si rigenera, cambiano con
-- lui. Forma: { "executive": [...], "mappa": [...], "piano": [...], "raccomandazioni": [...] }
-- (2-3 frasi brevi per voce). Report senza riassunti (prima di v81, o riassunti non
-- leggibili): la presentazione chiede di rigenerare il Report.
--
-- Nessun dato nuovo: frasi sui dati aggregati del Report. Stesse regole di accesso della
-- tabella (solo il server). Idempotente.

ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS presentazione jsonb;

COMMENT ON COLUMN public.generated_reports.presentazione IS
  'Riassunti per le slide della presentazione del Report di Attivazione (v81, 28/9): executive, mappa, piano, raccomandazioni.';
