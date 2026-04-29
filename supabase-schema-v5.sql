-- ES Work — Schema v5 (dettagli anamnesi sistemica)
-- Dashboard Supabase → SQL Editor → New Query → incolla → Run

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS vision_details   text,
  ADD COLUMN IF NOT EXISTS hearing_details  text,
  ADD COLUMN IF NOT EXISTS headaches_details text,
  ADD COLUMN IF NOT EXISTS bruxism_details  text;
