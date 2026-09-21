-- ============================================================================
-- v74 — Quota «Programma, misurazione e regia»: via il vecchio check-up del Pacchetto
-- ============================================================================
-- Decisione di Enrico (21/9): nuova voce di prezzo per anno di programma, €1.500 fissi +
-- €15 a dipendente, costo al 30%. Vive nel Listino v2 come parametri commerciali
-- (quota_programma_fissa, quota_programma_per_dipendente, quota_programma_costo_pct):
-- valgono i valori del codice finché non li modifichi dalla pagina del Listino.
-- Nel Pacchetto d'ingresso il check-up è la parte per dipendente della quota: il
-- vecchio parametro «assessment_prezzo_per_dipendente» (oggi 15, lo stesso numero) non
-- comanda più nulla e si toglie, perché un campo che non comanda nulla è peggio di
-- nessun campo. Le Stime già congelate non cambiano (regola nel codice).
-- Idempotente.

DELETE FROM public.pricing_settings WHERE version = 'v2' AND key = 'assessment_prezzo_per_dipendente';

-- Verifica (attesa: 0)
-- SELECT count(*) FROM public.pricing_settings WHERE key = 'assessment_prezzo_per_dipendente';
