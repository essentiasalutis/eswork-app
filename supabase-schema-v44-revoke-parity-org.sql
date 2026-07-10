-- ============================================================================
-- v44 — Parità REVOKE anon/authenticated sulle 3 tabelle org "sorelle"
-- ============================================================================
-- Follow-up APPROVATO (audit avversariale Blocco B). org_dipendente porta un REVOKE
-- esplicito da anon/authenticated (v37); le 3 sorelle avevano solo RLS-enabled-no-policy.
-- Questo allinea la difesa in profondità: la protezione non dipende più dal fatto che
-- la RLS non venga mai disabilitata. Non sfruttabile prima (RLS attiva), è hardening.
--
-- Numerazione: entra DOPO v43 (Blocco 2.A, già applicata) e PRIMA dell'RPC del
-- Blocco 2.B (v45), così i numeri restano in ordine di applicazione. Il TOCTOU del
-- rate-limit HR è il follow-up successivo (v46), schedulato subito dopo.
-- ============================================================================

REVOKE ALL ON public.org_sessione_formativa      FROM anon, authenticated;
REVOKE ALL ON public.org_partecipazione_formativa FROM anon, authenticated;
REVOKE ALL ON public.org_duplicato_validazione    FROM anon, authenticated;

-- Verifica (read-only) dopo l'applicazione — nessuna delle 3 deve avere grant anon:
--   SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_schema='public'
--     AND table_name IN ('org_sessione_formativa','org_partecipazione_formativa','org_duplicato_validazione')
--     AND grantee IN ('anon','authenticated');
--   -> attese 0 righe.
