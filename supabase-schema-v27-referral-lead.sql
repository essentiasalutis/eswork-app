-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v27-referral-lead.sql
-- Referral B2C — Fase 2: form di prenotazione su /care → lead strutturato.
-- Aggiunge i campi di contatto/disponibilità a referral_uses, così ogni richiesta
-- voucher è un lead completo (visibile all'admin e al professionista assegnato).
-- Esegui nel SQL Editor di Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS patient_phone  TEXT;
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS patient_email  TEXT;
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS preferred_when TEXT;  -- disponibilità indicata
ALTER TABLE referral_uses ADD COLUMN IF NOT EXISTS location       TEXT;  -- sede preferita
