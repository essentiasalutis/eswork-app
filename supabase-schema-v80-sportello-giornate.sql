-- ============================================================================
-- v80 — Giornate dello sportello (calendario, fase 1)
-- ============================================================================
-- Decisioni di Enrico (28/9). Principio: Essentia Salutis organizza lo sportello
-- (giorni, stanza, orari, posti); l'osteopata decide chi viene trattato e quando.
-- In questa fase il sistema NON mette nessuna persona in nessun posto: la tabella
-- non ha nessun riferimento a pazienti. La proposta della giornata, la conferma
-- dell'osteopata e gli appuntamenti ai lavoratori vengono dopo la risposta
-- dell'avvocato sulla qualificazione come struttura sanitaria (fase 2).
--
--   · posti = durata ÷ 30 minuti, modificabili giornata per giornata, con un minimo
--     di 3 ore (6 posti). Le pre-validazioni sono in videochiamata: non occupano posti.
--   · sedute_prenotate / ergonomia_persone: NUMERI scritti dall'osteopata, senza nomi
--     (risposta 1: serve l'allarme «meno di 6 posti» 7 giorni prima). L'ergonomia vale
--     5 minuti a persona: sei persone fanno un posto (lo calcola l'app).
--   · l'azienda vede solo le giornate e i posti, mai i prenotati (risposta 2).
--   · nessuna nota clinica: note_logistiche è per stanza, accessi, referente.
--
-- Solo il server legge e scrive (come v73). Idempotente.

CREATE TABLE IF NOT EXISTS public.sportello_giornate (
  id                     text PRIMARY KEY,
  client_id              text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  professional_id        text REFERENCES public.professionals(id),
  sede                   text,
  stanza                 text,
  data                   date NOT NULL,
  ora_inizio             time NOT NULL,
  ora_fine               time NOT NULL,
  posti                  integer NOT NULL,
  sedute_prenotate       integer,
  ergonomia_persone      integer,
  prenotazioni_il        timestamptz,
  prenotazioni_da        text,
  stato                  text NOT NULL DEFAULT 'pianificata',
  note_logistiche        text,
  created_by             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sportello_giornate_stato_chk CHECK (stato IN ('pianificata', 'annullata')),
  CONSTRAINT sportello_giornate_orario_chk CHECK (ora_fine - ora_inizio >= interval '3 hours'),
  CONSTRAINT sportello_giornate_posti_chk CHECK (posti >= 6),
  CONSTRAINT sportello_giornate_prenotate_chk CHECK (sedute_prenotate IS NULL OR sedute_prenotate >= 0),
  CONSTRAINT sportello_giornate_ergonomia_chk CHECK (ergonomia_persone IS NULL OR ergonomia_persone >= 0)
);

CREATE INDEX IF NOT EXISTS sportello_giornate_data_idx ON public.sportello_giornate (data);
CREATE INDEX IF NOT EXISTS sportello_giornate_cliente_idx ON public.sportello_giornate (client_id, data);
CREATE INDEX IF NOT EXISTS sportello_giornate_prof_idx ON public.sportello_giornate (professional_id, data);

-- ─── Permessi: solo il server ────────────────────────────────────────────────
ALTER TABLE public.sportello_giornate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sportello_giornate FROM anon, authenticated;
GRANT ALL ON public.sportello_giornate TO service_role;

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT count(*) FROM public.sportello_giornate;   -- 0 righe, nessun errore
