-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v41-listino-nullable.sql   (companion della v40)
-- Le colonne listino della v37 erano NOT NULL DEFAULT 350/500: ogni azienda è
-- "pinnata" al proprio valore → pricing_settings resterebbe inerte. Le rendiamo
-- opzionali (NULL = "usa il globale di pricing_settings") e azzeriamo i valori
-- pari al default corrente. ZERO cambiamento osservabile (globale = 350/500 =
-- valori attuali). Eventuali listini per-azienda PERSONALIZZATI (≠ default)
-- restano come override.
--
-- Precedenza in lettura (lib/org.js): override per-azienda (clients.listino_*)
--   → pricing_settings (Listino v2) → default del codice.
--
-- COME ESEGUIRE: incolla nel SQL Editor di Supabase ed esegui. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ALTER COLUMN listino_concentrata   DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN listino_concentrata   DROP DEFAULT;
ALTER TABLE public.clients ALTER COLUMN listino_base_completa DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN listino_base_completa DROP DEFAULT;

-- Azzera SOLO i valori pari al default (= "segui il globale"); preserva i custom.
UPDATE public.clients SET listino_concentrata   = NULL WHERE listino_concentrata   = 350;
UPDATE public.clients SET listino_base_completa = NULL WHERE listino_base_completa = 500;

-- Verifica: quante aziende hanno ancora un override (valore ≠ NULL)?
-- SELECT COUNT(*) FROM public.clients WHERE listino_concentrata IS NOT NULL;  -- solo i custom
