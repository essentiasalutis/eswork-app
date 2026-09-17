-- ============================================================================
-- v68 — Regole del protocollo: una sola fonte, nel codice
-- ============================================================================
-- Decisione di Enrico (17/9): le regole cliniche e contrattuali (sedute per ciclo,
-- durata, sessioni di prevenzione, cicli per anno di programma, distanza tra cicli,
-- auto-segnalazioni, buffer) vivono in lib/protocollo.mjs, con i test. Nessun
-- pannello le modifica: un valore modificabile al volo crea uno scostamento
-- silenzioso tra ciò che il sistema fa e ciò che è firmato con il cliente.
--
-- 1. admin_settings: nessuna riga era letta dal codice (solo dalla pagina Settings,
--    ora rimossa). Una mostrava persino un buffer (0,15) diverso da quello applicato
--    (0,20). Si cancellano tutte; la tabella resta vuota.
-- 2. pricing_settings v2: gli override dei parametri che sono regole del protocollo
--    non valgono più (il codice li ignora); si cancellano perché non restino a
--    far credere il contrario. Oggi coincidono con il protocollo (4 e 0,20).
-- Idempotente.

DELETE FROM public.admin_settings;

DELETE FROM public.pricing_settings
 WHERE version = 'v2'
   AND key IN ('sessions_per_l1', 'session_duration_min', 'prevention_sessions_per_l2', 'buffer_pct');

-- Verifica (attese: 0 e 0)
-- SELECT count(*) FROM public.admin_settings;
-- SELECT count(*) FROM public.pricing_settings WHERE version = 'v2'
--   AND key IN ('sessions_per_l1','session_duration_min','prevention_sessions_per_l2','buffer_pct');
