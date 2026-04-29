-- ES Work — Schema v4 (nuovi campi anamnesi sistemica)
-- Dashboard Supabase → SQL Editor → New Query → incolla → Run

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS has_cardiovascular_issues  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cardiovascular_details      text,
  ADD COLUMN IF NOT EXISTS has_gastrointestinal_issues boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gastrointestinal_details    text,
  ADD COLUMN IF NOT EXISTS obstetric_history           text;
