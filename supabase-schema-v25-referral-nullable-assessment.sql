-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v25-referral-nullable-assessment.sql
-- Referral B2C ora è opt-in e per-azienda (1 codice Dipendenti + 1 Famigliari),
-- non più legato alla chiusura di un assessment. Rende assessment_id opzionale.
-- Esegui nel SQL Editor di Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE referral_codes ALTER COLUMN assessment_id DROP NOT NULL;
