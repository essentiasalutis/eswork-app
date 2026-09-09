-- ============================================================================
-- v49 — Flag "azienda demo" (clients.is_demo)
-- ============================================================================
-- Contesto: tutte le aziende presenti ad oggi sono demo/prova (nessun programma
-- reale in esecuzione). Non vanno CANCELLATE — restano come riferimento — ma non
-- devono più inquinare gli aggregati: ARR, pipeline, forecast e margini della
-- dashboard Finance devono riflettere SOLO clienti reali, dal primo in poi.
--
-- Aziende marcate demo da questo script (le 7 esistenti al 2026-09-09):
--   c_plus_demo_2026        PLUS (demo Banca Sella, 500 pazienti)
--   c_1777965856949_dcrjl   SEFAR
--   c_1777965997563_zpp96   Banca Patrimoni Sella & C.
--   c_1779114097507_4rjfa   Industrie Lisa      [fixture regressione pricing v1]
--   c_1779780626388_sypzo   SKY ITALIA
--   c_1781186381663_ggsx6   CORE                [fixture regressione pricing v1]
--   c_1781692364276_sudx2   Servizi funebri piemonte srl
--
-- Regola: DEFAULT false → ogni azienda creata DOPO questa migration è reale.
-- Le due fixture di regressione (Industrie Lisa, CORE) restano intatte: il flag
-- non tocca pricing_version né alcun valore economico.
-- ============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Tutte le righe ESISTENTI in questo momento sono demo.
UPDATE public.clients SET is_demo = true;

COMMENT ON COLUMN public.clients.is_demo IS
  'true = azienda demo/prova: visibile in UI con badge, ESCLUSA dagli aggregati economici. Le nuove aziende nascono false.';

-- Verifica (attese: 7 demo, 0 reali finché non entra il primo cliente):
--   SELECT is_demo, COUNT(*) FROM public.clients GROUP BY is_demo;
--
-- Rollback: ALTER TABLE public.clients DROP COLUMN is_demo;
