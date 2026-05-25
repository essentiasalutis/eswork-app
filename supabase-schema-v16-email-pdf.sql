-- ============================================================
-- supabase-schema-v16-email-pdf.sql
-- Email log, documents, autosave, email su patients
-- DA ESEGUIRE: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Email su patients (per campagne assessment)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS email TEXT;
-- Stato assessment per singolo dipendente
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS assessment_invite_sent_at TIMESTAMPTZ;

-- Progresso assessment (autosave)
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS progress_data JSONB;

-- Log invii email
CREATE TABLE IF NOT EXISTS public.email_log (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  client_id    TEXT REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id TEXT REFERENCES public.professionals(id) ON DELETE SET NULL,
  template     TEXT NOT NULL,
  to_email     TEXT NOT NULL,
  subject      TEXT,
  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','opened')),
  error_message TEXT,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documenti generati (PDF preventivi e report)
CREATE TABLE IF NOT EXISTS public.documents (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('quote','activation_report','checkpoint_report','annual_report')),
  file_url     TEXT,
  content_text TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_patient ON public.email_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_email_log_client ON public.email_log(client_id);
CREATE INDEX IF NOT EXISTS idx_email_log_template ON public.email_log(template);
CREATE INDEX IF NOT EXISTS idx_documents_client ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients(email);

GRANT ALL ON public.email_log TO service_role;
GRANT ALL ON public.documents TO service_role;
