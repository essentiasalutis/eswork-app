-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v28-referral-confirm.sql
-- Referral B2C — Fase 3: conferma del paziente + incrocio anti-elusione.
-- Il paziente (incentivato dallo sconto) conferma se la visita è avvenuta.
-- Incrocio: confermata dal paziente MA non redenta dal pro → alert.
-- Esegui nel SQL Editor di Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS confirm_response TEXT;          -- 'done' | 'not_done'
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS confirmed_at     TIMESTAMPTZ;
