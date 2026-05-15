-- ─── ES Work — Schema v9: Consensi e documenti paziente ──────────────────────

-- Consensi pre-questionario (una riga per ogni risposta anonima)
CREATE TABLE IF NOT EXISTS assessment_consents (
  id                   TEXT PRIMARY KEY,
  assessment_id        TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  consent_privacy_at   TIMESTAMPTZ NOT NULL,
  consent_health_at    TIMESTAMPTZ NOT NULL,
  ip_hash              TEXT,
  user_agent           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Documenti e consensi formali per ogni paziente L1
-- type: consent_treatment | privacy_extended | anamnesi
-- status: pending | signed | completed
CREATE TABLE IF NOT EXISTS patient_documents (
  id               TEXT PRIMARY KEY,
  patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  professional_id  TEXT REFERENCES professionals(id),
  type             TEXT NOT NULL CHECK (type IN ('consent_treatment','privacy_extended','anamnesi')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','completed')),
  signed_at        TIMESTAMPTZ,
  signature_image  TEXT,      -- base64 PNG della firma grafica
  content_hash     TEXT,      -- SHA-256 del testo firmato
  ip_hash          TEXT,
  user_agent       TEXT,
  form_data        JSONB,     -- per anamnesi: campi strutturati
  pro_notes        TEXT,      -- note cliniche del professionista (solo anamnesi)
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_consents_assessment_id ON assessment_consents(assessment_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_client_id ON patient_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_type ON patient_documents(type);

ALTER TABLE assessment_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;
