-- ============================================================================
-- v73 — Medico competente: accesso ai soli aggregati, indicazioni su reparti
-- ============================================================================
-- Decisioni di Enrico (21/9):
--   · al medico competente non arriva NESSUN dato individuale, in nessuna forma;
--   · il ruolo è opzionale e additivo: il programma funziona per intero senza;
--   · relazione esplicita medico ↔ azienda, revocabile (la revoca chiude la riga,
--     non la cancella);
--   · assegnazione a un'azienda REALE solo se:
--       1. l'informativa del check-up in vigore ha la sezione con id fisso
--          'medico_competente' (il testo lo scrive l'avvocato);
--       2. sul profilo del medico sono caricati l'accordo e la dichiarazione dei
--          quattro presidi sul conflitto di interessi.
--     Le aziende demo (clients.is_demo) sono esenti. Il server fa lo stesso
--     controllo con il messaggio che spiega; qui è la seconda difesa;
--   · indicazioni: reparto o mansione scelti dall'elenco curato dal coordinamento
--     + un campo breve; visibili solo al coordinamento; la marcatura «non
--     utilizzabile» resta visibile e non cancella nulla;
--   · registro di ogni accesso e di ogni indicazione.
--
-- Prove e registri (documenti, indicazioni, accessi) sono solo in aggiunta e
-- senza FK verso l'azienda: la prova resta. Si possono cancellare SOLO le righe
-- di un'azienda demo ancora esistente (per rifare la demo).
-- Idempotente.

-- ─── Funzione comune: cancellazione ammessa solo per le aziende demo ─────────
CREATE OR REPLACE FUNCTION public.mc_e_demo(p_client TEXT) RETURNS boolean AS $f$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client AND is_demo = true);
$f$ LANGUAGE sql STABLE;

-- ─── 1. I medici competenti ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medici_competenti (
  id                   TEXT PRIMARY KEY,
  nome                 TEXT NOT NULL CHECK (length(trim(nome)) > 0),
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  must_reset_password  BOOLEAN NOT NULL DEFAULT true,
  attivo               BOOLEAN NOT NULL DEFAULT true,
  creato_il            TIMESTAMPTZ NOT NULL DEFAULT now(),
  disattivato_il       TIMESTAMPTZ
);

-- ─── 2. Documenti sul profilo: accordo e dichiarazione dei presidi ───────────
-- I quattro presidi: nessun compenso in nessuna forma; informazione e non
-- prescrizione; trasparenza verso il lavoratore; nessuna partecipazione alle
-- prestazioni. Il file è la prova; un nuovo caricamento è una riga nuova.
CREATE TABLE IF NOT EXISTS public.mc_documenti (
  id               TEXT PRIMARY KEY,
  medico_id        TEXT NOT NULL,                 -- senza FK: la prova resta
  tipo             TEXT NOT NULL CHECK (tipo IN ('accordo', 'dichiarazione_presidi')),
  testo_legale_id  TEXT REFERENCES public.testi_legali(id),   -- quando l'avvocato pubblicherà i testi
  file_path        TEXT NOT NULL,                 -- bucket privato
  file_mime        TEXT NOT NULL CHECK (file_mime IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_bytes       INTEGER NOT NULL CHECK (file_bytes > 0),
  file_impronta    TEXT NOT NULL,                 -- SHA-256 calcolato dal SERVER
  data_firma       DATE NOT NULL,
  caricato_da      TEXT NOT NULL,                 -- 'admin:<email>'
  caricato_il      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mc_documenti_medico ON public.mc_documenti(medico_id);

CREATE OR REPLACE FUNCTION public.mc_documenti_immutabile() RETURNS trigger AS $f$
BEGIN
  RAISE EXCEPTION 'mc_documenti: un documento caricato non si modifica né si cancella (se ne carica uno nuovo)';
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS mc_documenti_immutabile_trg ON public.mc_documenti;
CREATE TRIGGER mc_documenti_immutabile_trg BEFORE UPDATE OR DELETE ON public.mc_documenti
  FOR EACH ROW EXECUTE FUNCTION public.mc_documenti_immutabile();

-- ─── 3. Relazione medico ↔ azienda ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.medico_aziende (
  id             TEXT PRIMARY KEY,
  medico_id      TEXT NOT NULL REFERENCES public.medici_competenti(id),
  client_id      TEXT NOT NULL,                   -- senza FK: la storia resta
  dal            TIMESTAMPTZ NOT NULL DEFAULT now(),
  assegnato_da   TEXT NOT NULL,
  revocato_il    TIMESTAMPTZ,
  revocato_da    TEXT,
  CHECK ((revocato_il IS NULL) = (revocato_da IS NULL))
);
-- Una sola relazione attiva per coppia medico/azienda.
CREATE UNIQUE INDEX IF NOT EXISTS uq_medico_aziende_attiva ON public.medico_aziende(medico_id, client_id) WHERE revocato_il IS NULL;
CREATE INDEX IF NOT EXISTS idx_medico_aziende_client ON public.medico_aziende(client_id);

-- Seconda difesa sui due requisiti per un'azienda reale.
CREATE OR REPLACE FUNCTION public.medico_aziende_requisiti() RETURNS trigger AS $f$
DECLARE demo boolean;
BEGIN
  SELECT is_demo INTO demo FROM public.clients WHERE id = NEW.client_id;
  IF demo IS NULL THEN
    RAISE EXCEPTION 'medico_aziende: azienda % inesistente', NEW.client_id;
  END IF;
  IF demo THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.testi_legali t, jsonb_array_elements(COALESCE(t.contenuto->'sezioni', '[]'::jsonb)) s
     WHERE t.codice = 'informativa_checkup' AND t.stato = 'in_vigore'
       AND s->>'id' = 'medico_competente' AND length(trim(COALESCE(s->>'testo', ''))) > 0
  ) THEN
    RAISE EXCEPTION 'medico_aziende: l''informativa del check-up in vigore non prevede l''accesso del medico competente ai dati aggregati';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mc_documenti WHERE medico_id = NEW.medico_id AND tipo = 'accordo')
     OR NOT EXISTS (SELECT 1 FROM public.mc_documenti WHERE medico_id = NEW.medico_id AND tipo = 'dichiarazione_presidi') THEN
    RAISE EXCEPTION 'medico_aziende: mancano l''accordo o la dichiarazione dei presidi del medico';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS medico_aziende_requisiti_trg ON public.medico_aziende;
CREATE TRIGGER medico_aziende_requisiti_trg BEFORE INSERT ON public.medico_aziende
  FOR EACH ROW EXECUTE FUNCTION public.medico_aziende_requisiti();

-- Una relazione si revoca (una volta), non si modifica e non si cancella.
CREATE OR REPLACE FUNCTION public.medico_aziende_solo_revoca() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.mc_e_demo(OLD.client_id) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'medico_aziende: una relazione non si cancella, si revoca';
  END IF;
  IF OLD.revocato_il IS NOT NULL
     OR NEW.medico_id IS DISTINCT FROM OLD.medico_id OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.dal IS DISTINCT FROM OLD.dal OR NEW.assegnato_da IS DISTINCT FROM OLD.assegnato_da
     OR NEW.revocato_il IS NULL THEN
    RAISE EXCEPTION 'medico_aziende: una relazione si può solo revocare, una volta';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS medico_aziende_solo_revoca_trg ON public.medico_aziende;
CREATE TRIGGER medico_aziende_solo_revoca_trg BEFORE UPDATE OR DELETE ON public.medico_aziende
  FOR EACH ROW EXECUTE FUNCTION public.medico_aziende_solo_revoca();

-- ─── 4. Elenco reparti e mansioni, curato dal coordinamento ──────────────────
-- Dato organizzativo, senza legame con i dati di salute. Un nome non si
-- riscrive (cambierebbe il senso delle indicazioni già date): si disattiva e se
-- ne crea uno nuovo.
CREATE TABLE IF NOT EXISTS public.mc_reparti (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('reparto', 'mansione')),
  nome            TEXT NOT NULL CHECK (length(trim(nome)) BETWEEN 2 AND 80),
  attivo          BOOLEAN NOT NULL DEFAULT true,
  creato_il       TIMESTAMPTZ NOT NULL DEFAULT now(),
  disattivato_il  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mc_reparti_nome ON public.mc_reparti(client_id, tipo, lower(trim(nome))) WHERE attivo;

CREATE OR REPLACE FUNCTION public.mc_reparti_nome_fisso() RETURNS trigger AS $f$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'mc_reparti: il nome non si riscrive (si disattiva e se ne crea uno nuovo)';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS mc_reparti_nome_fisso_trg ON public.mc_reparti;
CREATE TRIGGER mc_reparti_nome_fisso_trg BEFORE UPDATE ON public.mc_reparti
  FOR EACH ROW EXECUTE FUNCTION public.mc_reparti_nome_fisso();

-- ─── 5. Le indicazioni del medico ────────────────────────────────────────────
-- Reparto o mansione dall'elenco (con il nome copiato: l'indicazione resta
-- leggibile anche se l'elenco cambia) + un campo breve, una riga, facoltativo.
-- La marcatura «non utilizzabile» si mette una volta e resta visibile.
CREATE TABLE IF NOT EXISTS public.mc_indicazioni (
  id                        TEXT PRIMARY KEY,
  medico_id                 TEXT NOT NULL,
  client_id                 TEXT NOT NULL,
  reparto_id                TEXT NOT NULL,
  reparto_tipo              TEXT NOT NULL CHECK (reparto_tipo IN ('reparto', 'mansione')),
  reparto_nome              TEXT NOT NULL,
  testo                     TEXT CHECK (testo IS NULL OR (length(testo) <= 160 AND position(E'\n' IN testo) = 0)),
  creato_il                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  non_utilizzabile_il       TIMESTAMPTZ,
  non_utilizzabile_da       TEXT,
  non_utilizzabile_motivo   TEXT,
  CHECK ((non_utilizzabile_il IS NULL) = (non_utilizzabile_da IS NULL)),
  CHECK (non_utilizzabile_il IS NULL OR length(trim(COALESCE(non_utilizzabile_motivo, ''))) >= 3)
);
CREATE INDEX IF NOT EXISTS idx_mc_indicazioni_client ON public.mc_indicazioni(client_id, creato_il);

-- Il reparto scelto deve essere dell'azienda dell'indicazione e attivo.
CREATE OR REPLACE FUNCTION public.mc_indicazioni_reparto_valido() RETURNS trigger AS $f$
DECLARE r RECORD;
BEGIN
  SELECT client_id, tipo, nome, attivo INTO r FROM public.mc_reparti WHERE id = NEW.reparto_id;
  IF r.client_id IS DISTINCT FROM NEW.client_id OR NOT r.attivo THEN
    RAISE EXCEPTION 'mc_indicazioni: reparto o mansione non valido per questa azienda';
  END IF;
  IF NEW.reparto_nome IS DISTINCT FROM r.nome OR NEW.reparto_tipo IS DISTINCT FROM r.tipo THEN
    RAISE EXCEPTION 'mc_indicazioni: nome del reparto diverso dall''elenco';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS mc_indicazioni_reparto_trg ON public.mc_indicazioni;
CREATE TRIGGER mc_indicazioni_reparto_trg BEFORE INSERT ON public.mc_indicazioni
  FOR EACH ROW EXECUTE FUNCTION public.mc_indicazioni_reparto_valido();

CREATE OR REPLACE FUNCTION public.mc_indicazioni_solo_marcatura() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.mc_e_demo(OLD.client_id) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'mc_indicazioni: un''indicazione non si cancella (si può marcare «non utilizzabile»)';
  END IF;
  IF OLD.non_utilizzabile_il IS NOT NULL
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.medico_id IS DISTINCT FROM OLD.medico_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.reparto_id IS DISTINCT FROM OLD.reparto_id
     OR NEW.reparto_tipo IS DISTINCT FROM OLD.reparto_tipo OR NEW.reparto_nome IS DISTINCT FROM OLD.reparto_nome
     OR NEW.testo IS DISTINCT FROM OLD.testo OR NEW.creato_il IS DISTINCT FROM OLD.creato_il
     OR NEW.non_utilizzabile_il IS NULL THEN
    RAISE EXCEPTION 'mc_indicazioni: un''indicazione non si modifica; si può solo marcare «non utilizzabile», una volta';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS mc_indicazioni_solo_marcatura_trg ON public.mc_indicazioni;
CREATE TRIGGER mc_indicazioni_solo_marcatura_trg BEFORE UPDATE OR DELETE ON public.mc_indicazioni
  FOR EACH ROW EXECUTE FUNCTION public.mc_indicazioni_solo_marcatura();

-- ─── 6. Registro degli accessi del medico ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mc_accessi (
  id          TEXT PRIMARY KEY,
  medico_id   TEXT NOT NULL,
  client_id   TEXT,                               -- null per login e pagine senza azienda
  azione      TEXT NOT NULL CHECK (length(trim(azione)) > 0),
  dettaglio   TEXT,
  esito       TEXT NOT NULL DEFAULT 'ok' CHECK (esito IN ('ok', 'rifiutato')),
  ip_hash     TEXT,
  user_agent  TEXT,
  creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mc_accessi_medico ON public.mc_accessi(medico_id, creato_il);

CREATE OR REPLACE FUNCTION public.mc_accessi_solo_aggiunta() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.client_id IS NOT NULL AND public.mc_e_demo(OLD.client_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'mc_accessi: il registro è solo in aggiunta';
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS mc_accessi_solo_aggiunta_trg ON public.mc_accessi;
CREATE TRIGGER mc_accessi_solo_aggiunta_trg BEFORE UPDATE OR DELETE ON public.mc_accessi
  FOR EACH ROW EXECUTE FUNCTION public.mc_accessi_solo_aggiunta();

-- ─── Permessi: solo il server ────────────────────────────────────────────────
ALTER TABLE public.medici_competenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_documenti      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medico_aziende    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_reparti        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_indicazioni    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mc_accessi        ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medici_competenti, public.mc_documenti, public.medico_aziende,
              public.mc_reparti, public.mc_indicazioni, public.mc_accessi FROM anon, authenticated;
GRANT ALL ON public.medici_competenti, public.mc_documenti, public.medico_aziende,
             public.mc_reparti, public.mc_indicazioni, public.mc_accessi TO service_role;
REVOKE ALL ON FUNCTION public.mc_e_demo(TEXT) FROM anon, authenticated;

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT count(*) FROM public.medici_competenti;   -- 0
-- SELECT tgname FROM pg_trigger WHERE tgrelid IN ('public.medico_aziende'::regclass, 'public.mc_indicazioni'::regclass, 'public.mc_accessi'::regclass, 'public.mc_documenti'::regclass, 'public.mc_reparti'::regclass) AND NOT tgisinternal ORDER BY 1;
--   → 7 righe: mc_accessi_solo_aggiunta_trg, mc_documenti_immutabile_trg, mc_indicazioni_reparto_trg,
--     mc_indicazioni_solo_marcatura_trg, mc_reparti_nome_fisso_trg, medico_aziende_requisiti_trg, medico_aziende_solo_revoca_trg
