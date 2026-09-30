-- ============================================================================
-- v83 — Neoassunti e anagrafica dal check-up (Enrico, 30/9)
-- ============================================================================
-- 1. patients.neoassunto: vero per chi entra dall'invito del neoassunto (pagina
--    /invito, dopo l'«aggiungi ingresso» dell'HR). Serve a due regole:
--      · il neoassunto in Livello 2 fa la prevenzione dall'anno di programma
--        successivo (intanto formazione e autosegnalazione);
--      · il neoassunto in Livello 1 prende uno dei «posti per i nuovi L1».
--    Chi compila il check-up in ritardo NON è un neoassunto: si riapre il check-up
--    e si ricalcola la proposta. È un'etichetta sulla persona, non un collegamento
--    all'anagrafica organizzativa (vincolo #1 resta: nessun id org sul paziente).
--    La scrive /api/invito/submit subito dopo la RPC consuma_invito_neoassunto.
-- 2. org_dipendente.inserito_da ammette 'checkup': i nomi entrano da soli in
--    anagrafica dal check-up (copia del solo nome, come il vecchio pulsante
--    «Importa nomi dal check-up», che non c'è più).
-- Senza questa migration il codice ripiega: nessuno risulta neoassunto (la
-- prevenzione parte subito, come prima) e i nomi importati risultano 'admin'.
-- ============================================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS neoassunto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.patients.neoassunto IS
  'Entrato dall''invito del neoassunto (v83): prevenzione dall''anno di programma successivo; in Livello 1 prende un posto per i nuovi L1.';

-- Toglie il vincolo di v37 qualunque nome abbia, poi lo rimette con 'checkup'.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.org_dipendente'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%inserito_da%'
  LOOP
    EXECUTE format('ALTER TABLE public.org_dipendente DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE public.org_dipendente
  ADD CONSTRAINT org_dipendente_inserito_da_check CHECK (inserito_da IN ('admin', 'hr', 'checkup'));
