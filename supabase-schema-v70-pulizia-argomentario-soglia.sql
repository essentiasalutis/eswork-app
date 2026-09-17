-- ============================================================================
-- v70 — Riga orfana dell'argomentario del buffer; soglia di recupero per azienda
-- ============================================================================
-- Decisioni di Enrico (17/9):
-- 1. `argomentario_buffer` era un segnaposto mai scritto che nessuna pagina mostra
--    né modifica: si cancella.
-- 2. La soglia di recupero dei neoassunti è quella della fascia del contratto
--    (Art. 5-bis c. 5): nessun override per azienda. Il codice non legge più
--    clients.soglia_x e la pagina Formazione non lo mostra. Oggi nessuna azienda
--    lo usava; la colonna resta (vuota) e si documenta come dismessa.
-- Idempotente.

DELETE FROM public.pricing_settings WHERE key = 'argomentario_buffer';

UPDATE public.clients SET soglia_x = NULL WHERE soglia_x IS NOT NULL;
COMMENT ON COLUMN public.clients.soglia_x IS
  'DISMESSA (17/9): la soglia di recupero è quella della fascia del contratto, Art. 5-bis c. 5 (lib/protocollo.mjs). Non letta dal codice.';

-- Verifica (attese: 0 e 0)
-- SELECT count(*) FROM public.pricing_settings WHERE key = 'argomentario_buffer';
-- SELECT count(*) FROM public.clients WHERE soglia_x IS NOT NULL;
