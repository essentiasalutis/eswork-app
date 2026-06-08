-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v24-enable-rls.sql
-- Sicurezza: abilita Row-Level Security su TUTTE le tabelle dello schema public.
--
-- PERCHÉ: il Security Advisor di Supabase segnala "rls_disabled_in_public" e
-- "sensitive_columns_exposed" → le tabelle (dati pazienti, clinici, personali)
-- sono raggiungibili dalla Data API senza restrizioni.
--
-- PERCHÉ È SICURO PER L'APP: ES Work accede al DB SOLO con la chiave service_role
-- (lato server, lib/db.js). Il ruolo service_role BYPASSA sempre l'RLS, quindi
-- l'app continua a funzionare identica. Non esistono accessi anon/authenticated
-- lato client (nessun uso della anon key nel bundle). Abilitando l'RLS senza
-- aggiungere policy, i ruoli anon/authenticated vengono NEGATI di default → la
-- Data API pubblica non espone più nulla. Questo risolve entrambe le criticità.
--
-- COME ESEGUIRE: incolla tutto questo file nel SQL Editor di Supabase ed esegui.
-- È idempotente: rieseguirlo non causa errori.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    RAISE NOTICE 'RLS abilitata su public.%', r.tablename;
  END LOOP;
END $$;

-- ── Verifica: nessuna tabella public deve avere rowsecurity = false ───────────
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY rowsecurity, tablename;
--
-- Nota: NON aggiungiamo policy. Senza policy, anon/authenticated non possono
-- leggere/scrivere nulla (deny by default), mentre service_role continua a
-- bypassare l'RLS. Se un domani servisse esporre qualcosa alla Data API pubblica
-- (es. un endpoint anon), si aggiungerà una policy mirata SOLO su quella tabella.
