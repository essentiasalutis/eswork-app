-- ============================================================================
-- v72 — Chi valida i report: solo nel codice
-- ============================================================================
-- Decisione di Enrico (18/9): la riga di validazione è una dichiarazione di
-- responsabilità clinica personale («Dott. Enrico Maiolo, osteopata, responsabile
-- clinico del programma»). Vive in lib/validazione.js, non in un pannello
-- modificabile: il campo è stato tolto dalla pagina Listino e il codice non legge
-- più questa impostazione. Nessun report era stato validato con la formula vecchia.
-- Idempotente.

DELETE FROM public.pricing_settings WHERE key = 'validatore_nome';

-- Verifica (attesa: 0)
-- SELECT count(*) FROM public.pricing_settings WHERE key = 'validatore_nome';
