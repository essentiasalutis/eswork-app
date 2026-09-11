-- ─────────────────────────────────────────────────────────────────────────────
-- v53 — Binario commerciale (A/B) e Lettera di incarico, sull'azienda.
--
-- Binario (decisione di Enrico, MAI automatico): A = micro/piccola, decide il
-- titolare, nessun documento prima del contratto; B = media/grande, HR/board,
-- Lettera di incarico dopo la Stima. NULL = non ancora deciso.
-- Lettera: solo tracciamento + file firmato (il testo è dell'avvocato).
--
-- Da applicare in Supabase (SQL editor). Idempotente. Ordine sicuro: prima o
-- dopo il deploy (il codice non scrive queste colonne finché non esistono).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS binario text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lettera_stato text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lettera_inviata_il date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lettera_firmata_il date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lettera_file_path text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_binario_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_binario_check
      CHECK (binario IS NULL OR binario IN ('A','B'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_lettera_stato_check') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_lettera_stato_check
      CHECK (lettera_stato IS NULL OR lettera_stato IN ('da_inviare','inviata','firmata'));
  END IF;
END $$;

-- Verifica (read-only) — 5 righe:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'
--    AND column_name IN ('binario','lettera_stato','lettera_inviata_il','lettera_firmata_il','lettera_file_path');
