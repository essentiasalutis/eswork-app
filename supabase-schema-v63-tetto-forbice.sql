-- ============================================================================
-- v63 — Il massimo promesso è il massimo (tetto della forbice)
-- ============================================================================
-- Decisione di Enrico (14/9): il corrispettivo del PRIMO ANNO non supera il
-- massimo della forbice indicata nella Stima, anche quando la prevalenza reale
-- risulta superiore all'atteso di settore. La forbice è l'unica promessa
-- economica fatta prima del contratto, ed è ciò che convince l'azienda a far
-- compilare il check-up: se può essere superata non è una forbice, e lo
-- snapshot congelato perde senso.
--
-- Si PUÒ comunque emettere un'offerta sopra il massimo, ma solo con una
-- conferma consapevole e una motivazione registrata: non deve poter accadere
-- per distrazione. Queste quattro colonne tengono quella traccia.
--
-- Perché su `clients` e non su una tabella a sé: lo sforamento è uno stato
-- dell'offerta corrente dell'azienda, una alla volta. Il dato viene poi copiato
-- dentro generated_reports.quote_compliance (v36) quando si genera il Report,
-- così resta legato al documento che ha fissato il prezzo.
--
-- Senza questa migration il tetto funziona lo stesso (il prezzo proposto resta
-- il massimo promesso), ma NON si può emettere un'offerta sopra il tetto: senza
-- un posto dove registrare la motivazione, l'eccezione non lascerebbe traccia —
-- e l'interfaccia chiede di applicare la v63.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS sforamento_forbice_motivo     TEXT,
  ADD COLUMN IF NOT EXISTS sforamento_forbice_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sforamento_forbice_calcolato  INTEGER,   -- € Anno 1 dal motore
  ADD COLUMN IF NOT EXISTS sforamento_forbice_applicato  INTEGER;   -- € Anno 1 effettivamente proposto

COMMENT ON COLUMN public.clients.sforamento_forbice_motivo IS
  'Motivazione interna dello sforamento del massimo della forbice. MAI mostrata al cliente.';

-- Verifica (facoltativa):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'clients' AND column_name LIKE 'sforamento_forbice%';
