-- ============================================================================
-- v69 — Recupero neoassunti: regola del protocollo, non del Listino
-- ============================================================================
-- Decisione di Enrico (17/9): la finestra di recupero (6 mesi) e le soglie per fascia
-- (5 fino a 50 dipendenti, 10 tra 51 e 200, 20 oltre 200) sono scritte nel contratto
-- azienda, Art. 5-bis comma 5. Vivono in lib/protocollo.mjs; il codice non legge più
-- queste righe e il Listino non le mostra come modificabili. Si cancellano perché
-- non restino a far credere il contrario. Oggi coincidono con il protocollo.
-- Idempotente.

DELETE FROM public.pricing_settings
 WHERE version = 'v2'
   AND key IN ('finestra_recupero_mesi', 'soglia_recupero_fasce');

-- Verifica (attesa: 0)
-- SELECT count(*) FROM public.pricing_settings WHERE key IN ('finestra_recupero_mesi','soglia_recupero_fasce');
