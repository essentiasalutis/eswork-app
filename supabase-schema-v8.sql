-- ─── ES Work — Schema v8: Referral B2C — tipo P/F, scadenza, max_uses ─────────
-- Esegui su Supabase SQL Editor (una volta sola)

ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS type        TEXT    DEFAULT 'P' CHECK (type IN ('P','F'));
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ;
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS max_uses    INTEGER;   -- NULL = illimitato, 1 = F code
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS session_price NUMERIC(10,2) DEFAULT 65.00;

-- I codici esistenti senza tipo diventano 'P'
UPDATE referral_codes SET type = 'P' WHERE type IS NULL;
