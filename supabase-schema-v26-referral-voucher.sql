-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v26-referral-voucher.sql
-- Referral B2C — Fase 1: voucher univoco + redenzione del professionista.
-- Ogni richiesta su /care genera un voucher; il pro lo redime nella sua area
-- (= prova della visita avvenuta) registrando l'importo. Così conversione e
-- revenue diventano reali e anti-elusione.
-- Esegui nel SQL Editor di Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS voucher_code TEXT;
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'requested';  -- requested | redeemed
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS redeemed_at  TIMESTAMPTZ;
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS redeemed_by  TEXT;          -- professional_id che redime
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS amount       NUMERIC(10,2); -- importo dichiarato alla redenzione

CREATE INDEX IF NOT EXISTS idx_referral_uses_voucher ON referral_uses(voucher_code);
