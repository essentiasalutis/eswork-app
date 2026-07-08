-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v41-listino-nullable.sql   (companion della v40)
-- APPLICATA in produzione. Sul DB reale è risultata un NO-OP (le colonne erano
-- già nullable, senza default, e nessuna azienda aveva 350/500: tutte NULL — lo
-- stato reale era già divergente dal 'NOT NULL DEFAULT' del file v37). La teniamo
-- comunque nel repo perché:
--   1. i file migration devono rispecchiare ciò che è stato applicato in produzione;
--   2. riconcilia la deriva del file v37 per eventuali rebuild da zero (un rebuild
--      applicherebbe v37 con NOT NULL DEFAULT → questa v41 lo riporta a nullable,
--      allineando il rebuild alla produzione).
--
-- Effetto: listino_* nullable, senza default. NULL = "usa il globale di
-- pricing_settings". Precedenza in lettura (lib/org.js): override per-azienda
--   (clients.listino_*) → pricing_settings (Listino v2) → default del codice.
-- Idempotente: rieseguirla è innocuo.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ALTER COLUMN listino_concentrata   DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN listino_concentrata   DROP DEFAULT;
ALTER TABLE public.clients ALTER COLUMN listino_base_completa DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN listino_base_completa DROP DEFAULT;

-- Azzera SOLO i valori pari al default (= "segui il globale"); preserva i custom.
-- Sul DB reale: 0 righe (tutte già NULL).
UPDATE public.clients SET listino_concentrata   = NULL WHERE listino_concentrata   = 350;
UPDATE public.clients SET listino_base_completa = NULL WHERE listino_base_completa = 500;
