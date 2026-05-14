-- ─── ES Work — Schema v7: Referral B2C ───────────────────────────────────────
-- Esegui questo script su Supabase SQL Editor (una volta sola)

-- Tabella dei codici referral (uno per assessment chiuso)
CREATE TABLE IF NOT EXISTS referral_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  code        TEXT UNIQUE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabella dei log di utilizzo
CREATE TABLE IF NOT EXISTS referral_uses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id  UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  patient_name      TEXT,
  used_at           TIMESTAMPTZ DEFAULT NOW(),
  ip                TEXT
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_referral_codes_client_id ON referral_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_uses_code_id ON referral_uses(referral_code_id);

-- RLS (il service_role bypassa automaticamente, le policy servono per anon)
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_uses ENABLE ROW LEVEL SECURITY;
