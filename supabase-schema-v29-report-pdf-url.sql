-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v29-report-pdf-url.sql
-- Report AI: PDF ospitato riapribile + fix archivio Report Annuale.
-- 1) Aggiunge pdf_url a generated_reports: il link al PDF con grafica curata
--    resta disponibile anche riaprendo un report salvato.
-- 2) Allarga il CHECK su report_type per includere 'checkpoint_t12': prima
--    l'insert del Report Annuale falliva silenziosamente (non restava in archivio).
-- Esegui nel SQL Editor di Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS pdf_url TEXT;

ALTER TABLE generated_reports DROP CONSTRAINT IF EXISTS generated_reports_report_type_check;
ALTER TABLE generated_reports ADD CONSTRAINT generated_reports_report_type_check
  CHECK (report_type IN ('activation','checkpoint_t3','checkpoint_t6','checkpoint_t12','annual_t12','quote'));
