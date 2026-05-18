-- ============================================================
-- supabase-schema-v12-contract-date.sql
-- Aggiunge contract_start_date ai clients per i reminder checkpoint
-- DA ESEGUIRE: Supabase Dashboard → SQL Editor → Run
-- ============================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contract_start_date DATE;
