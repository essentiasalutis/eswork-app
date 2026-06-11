-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v30-contracted-l1.sql
-- Capacità contrattuale trattamenti: clients.contracted_l1 = numero di L1 a
-- contratto (quello su cui è stato calcolato il prezzo). La capacità annuale è
-- contracted_l1 × (1 + buffer 20%) percorsi di trattamento. Quando il consumo
-- (cicli avviati + candidati in coda) raggiunge la capacità, i self-trigger
-- vengono bloccati automaticamente e l'avvio di nuovi cicli viene fermato.
-- Se NULL, il sistema usa come fallback gli L1 reali dell'assessment iniziale.
-- Esegui nel SQL Editor di Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients ADD COLUMN IF NOT EXISTS contracted_l1 INTEGER;
