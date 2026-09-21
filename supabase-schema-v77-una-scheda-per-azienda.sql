-- ============================================================================
-- v77 — Una sola scheda del colloquio per azienda
-- ============================================================================
-- Decisione di Enrico (21/9). Due salvataggi ravvicinati su un'azienda nuova
-- creavano due schede; da lì la piattaforma non ne leggeva nessuna e ogni
-- salvataggio ne aggiungeva un'altra (Industrie Lisa: 15, il 13/9 alle 22:00).
--
-- 1. Industrie Lisa: resta la scheda 12 (manifattura, 13/9 22:01:33), scelta da
--    Enrico; le altre 14 si cancellano. Copia di tutte e 15 salvata prima.
--    Nella scheda il nome diventa «Industrie Lisa»; l'anagrafica torna manifattura
--    (sector = 1), come la scheda: la divergenza tornerebbe al primo ricalcolo.
-- 2. Controllo: se un'altra azienda avesse più schede, la migration si ferma.
-- 3. Indice unico su client_id: due schede per la stessa azienda sono impossibili,
--    e il salvataggio che arriva secondo aggiorna quella appena creata.

BEGIN;

DO $v77$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.first_meetings WHERE id = 'fm_1789336893477_4mrmj' AND client_id = 'c_1789336801506_drx2e') THEN
    RAISE EXCEPTION 'v77: la scheda scelta per Industrie Lisa non esiste: niente viene cancellato';
  END IF;
END $v77$;

DELETE FROM public.first_meetings
 WHERE client_id = 'c_1789336801506_drx2e'
   AND id <> 'fm_1789336893477_4mrmj';

DO $v77b$
BEGIN
  IF EXISTS (SELECT client_id FROM public.first_meetings GROUP BY client_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'v77: un''altra azienda ha più schede del colloquio: niente viene cancellato';
  END IF;
END $v77b$;

UPDATE public.first_meetings
   SET data = jsonb_set(data, '{step1,nome}', '"Industrie Lisa"'::jsonb),
       sector = 1,
       updated_at = now()
 WHERE id = 'fm_1789336893477_4mrmj';

UPDATE public.clients
   SET sector = 1
 WHERE id = 'c_1789336801506_drx2e';

CREATE UNIQUE INDEX IF NOT EXISTS uq_first_meetings_client_id ON public.first_meetings(client_id);

COMMIT;

-- Verifica (facoltativa):
-- SELECT id, data->'step1'->>'nome', data->'step1'->>'sector', sector FROM public.first_meetings WHERE client_id = 'c_1789336801506_drx2e';
--   → 1 riga: fm_1789336893477_4mrmj | Industrie Lisa | manufacturing | 1
-- SELECT sector FROM public.clients WHERE id = 'c_1789336801506_drx2e';  -- 1
-- SELECT indexname FROM pg_indexes WHERE indexname = 'uq_first_meetings_client_id';        -- 1 riga
