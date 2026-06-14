-- ─── ES Work — Schema v34: Documenti e conformità del professionista ─────────
-- Documenti obbligatori da contratto di collaborazione (identità, iscrizione
-- albo, polizza RC + quietanza, contratto firmato).
--
-- BASE GIURIDICA: art. 6.1.b GDPR (esecuzione del contratto col professionista).
--   NON sono dati sanitari su consenso e NON c'entrano col Livello A/B clinico
--   dei pazienti: tabella, bucket Storage e azioni di log SEPARATI.
-- RETENTION: NON segue la conservazione clinica di 10 anni. Conservazione per
--   la durata del rapporto + il periodo necessario alla prova dei requisiti,
--   gestita dall'admin (expiry_date manuale). Nessun automatismo di cancellazione
--   su questa tabella (la retention assistita /dashboard/retention riguarda i
--   soli pazienti, non questa tabella).
-- MINIMIZZAZIONE: un documento CORRENTE per tipo (UNIQUE). Il re-upload sostituisce
--   il file nel bucket (il vecchio viene rimosso dallo Storage lato applicazione).

CREATE TABLE IF NOT EXISTS public.pro_documents (
  id              TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('identity','albo','rc_policy','rc_receipt','contract')),
  file_path       TEXT NOT NULL,        -- percorso nel bucket privato pro-documents
  file_name       TEXT,
  mime_type       TEXT,
  size_bytes      INTEGER,
  expiry_date     DATE,                 -- valorizzata per la polizza RC (rc_policy)
  uploaded_by     TEXT,                 -- 'pro' | 'admin'
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (professional_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_pro_documents_pro  ON public.pro_documents(professional_id);
CREATE INDEX IF NOT EXISTS idx_pro_documents_type ON public.pro_documents(doc_type);

-- ─── Registro accessi DEDICATO ai documenti del professionista ────────────────
-- SEPARATO da access_logs (che resta il registro dei soli accessi ai DATI SANITARI
-- dei pazienti). Trattamento distinto (art. 6.1.b) → registro proprio.
--   action     : upload_pro_doc | view_pro_doc | delete_pro_doc
--   professional_id : soggetto del documento (ON DELETE SET NULL: l'audit resta)
--   actor_type/actor_id : chi ha fatto l'azione ('pro'+proId | 'admin'+email)
--   ip_hash    : IP anonimizzato (mai in chiaro, coerente con gli altri audit)
CREATE TABLE IF NOT EXISTS public.pro_document_access_log (
  id              TEXT PRIMARY KEY,
  professional_id TEXT REFERENCES public.professionals(id) ON DELETE SET NULL,
  doc_type        TEXT,
  action          TEXT NOT NULL CHECK (action IN ('upload_pro_doc','view_pro_doc','delete_pro_doc')),
  actor_type      TEXT,
  actor_id        TEXT,
  ip_hash         TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prodoc_log_pro     ON public.pro_document_access_log(professional_id);
CREATE INDEX IF NOT EXISTS idx_prodoc_log_created ON public.pro_document_access_log(created_at DESC);

-- RLS coerente col resto del progetto: abilitata, l'app accede col service_role
-- (l'isolamento è applicativo). Niente policy (chiude la Data API pubblica).
ALTER TABLE public.pro_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_document_access_log ENABLE ROW LEVEL SECURITY;
