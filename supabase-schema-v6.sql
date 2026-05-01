-- ES Work — Schema v6: correzione numerazione sessioni
-- Riassegna session_number in ordine cronologico per ogni paziente
-- (risolve sessioni orfane che hanno alterato il conteggio)
-- Dashboard Supabase → SQL Editor → New Query → incolla → Run

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id
      ORDER BY date ASC, created_at ASC
    ) AS new_number
  FROM sessions
  WHERE closed_at IS NOT NULL
)
UPDATE sessions
SET session_number = ranked.new_number
FROM ranked
WHERE sessions.id = ranked.id;

-- Elimina le sessioni orfane (aperte e mai chiuse)
DELETE FROM sessions WHERE closed_at IS NULL;
