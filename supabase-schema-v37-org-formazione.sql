-- ─── ES Work — v37: PIANO ORGANIZZATIVO (anagrafica + formazione) ───────────────
-- Tracciamento formazione per dipendente e gestione nuovi ingressi (turnover).
--
-- SEPARAZIONE DAL PIANO CLINICO (vincolo non negoziabile): le tabelle org_* NON
-- contengono alcun campo sanitario e NON hanno FK/join individuale verso
-- patients/assessments/responses/sessions. L'unico ancoraggio condiviso è
-- client_id (l'AZIENDA, entità organizzativa): MAI un legame fra un dipendente e
-- un paziente. (I nomi si pre-popolano COPIANDO first_name/last_name dalla
-- popolazione assessment all'attivazione — copia, non collegamento.)
--
-- TERMINOLOGIA: "tipo"/"configurazione", mai "livello" (Livello = solo clinico).
--
-- Idempotente: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ENABLE RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) AZIENDA: parametri di programma sul record clients esistente (organizzativo).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_avvio_programma  date;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS anno_programma        integer;       -- override manuale; se NULL l'app lo deriva da data_avvio_programma
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS popolazione_aderente  integer;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS soglia_x              integer;       -- default per fascia calcolato dall'app all'attivazione (≤50→5; 51–200→10; >200→20), poi modificabile
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS capienza_gruppo       integer;       -- OBBLIGATORIO all'attivazione (logistica azienda) — nessun default fisso
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS listino_concentrata   numeric NOT NULL DEFAULT 350;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS listino_base_completa numeric NOT NULL DEFAULT 500;

-- 2) ANAGRAFICA DIPENDENTI (nominativa). Lettura/titolarità: solo admin.
CREATE TABLE IF NOT EXISTS public.org_dipendente (
  id                text PRIMARY KEY,
  client_id         text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nome              text NOT NULL,
  matricola         text,                 -- opzionale; NESSUN UNIQUE (un errore rivelerebbe l'esistenza del record)
  identificativo_hr text,
  data_ingresso     date,
  data_cessazione   date,
  attivo            boolean NOT NULL DEFAULT true,
  straordinario     boolean NOT NULL DEFAULT false,
  inserito_da       text    NOT NULL DEFAULT 'admin' CHECK (inserito_da IN ('admin','hr')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 3) SESSIONI FORMATIVE (tipo/configurazione — mai "livello").
CREATE TABLE IF NOT EXISTS public.org_sessione_formativa (
  id               text PRIMARY KEY,
  client_id        text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tipo             text NOT NULL CHECK (tipo    IN ('base','base_concentrata','aggiornamento')),
  origine          text NOT NULL CHECK (origine IN ('campagna_aggiornamento','recupero_autonomo','base_anno1')),
  anno_programma   integer,
  gruppo           text,
  data_pianificata date,
  data_erogazione  date,
  stato            text NOT NULL DEFAULT 'pianificata' CHECK (stato IN ('pianificata','erogata','annullata')),
  a_consumo        boolean NOT NULL DEFAULT false,
  importo_dovuto   numeric,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 4) PARTECIPAZIONI (stato formativo del singolo dipendente).
CREATE TABLE IF NOT EXISTS public.org_partecipazione_formativa (
  id                    text PRIMARY KEY,
  dipendente_id         text NOT NULL REFERENCES public.org_dipendente(id) ON DELETE CASCADE,
  sessione_formativa_id text REFERENCES public.org_sessione_formativa(id) ON DELETE SET NULL,
  tipo                  text NOT NULL CHECK (tipo IN ('base','base_concentrata','aggiornamento')),
  data_svolgimento      date,
  stato                 text NOT NULL DEFAULT 'da_recuperare' CHECK (stato IN ('da_recuperare','pianificata','svolta')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 5) CODA VALIDAZIONE DUPLICATI (solo admin). L'insert va SEMPRE a buon fine; il
--    sospetto duplicato finisce qui (avviso non bloccante). Match: forte=matricola,
--    debole=nome+data_ingresso, nella stessa azienda.
CREATE TABLE IF NOT EXISTS public.org_duplicato_validazione (
  id                  text PRIMARY KEY,
  client_id           text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  dipendente_id       text NOT NULL REFERENCES public.org_dipendente(id) ON DELETE CASCADE,  -- il nuovo inserito
  match_dipendente_id text REFERENCES public.org_dipendente(id) ON DELETE SET NULL,          -- l'esistente sospetto
  match_tipo          text CHECK (match_tipo IN ('forte_matricola','debole_nome_data')),
  stato               text NOT NULL DEFAULT 'aperto' CHECK (stato IN ('aperto','confermato_distinto','unito')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_org_dip_client    ON public.org_dipendente(client_id);
CREATE INDEX IF NOT EXISTS idx_org_dip_coda      ON public.org_dipendente(client_id, attivo, straordinario, data_cessazione);
CREATE INDEX IF NOT EXISTS idx_org_dip_matricola ON public.org_dipendente(client_id, matricola);
CREATE INDEX IF NOT EXISTS idx_org_sess_client   ON public.org_sessione_formativa(client_id, stato);
CREATE INDEX IF NOT EXISTS idx_org_part_dip      ON public.org_partecipazione_formativa(dipendente_id, tipo, stato);
CREATE INDEX IF NOT EXISTS idx_org_part_sess     ON public.org_partecipazione_formativa(sessione_formativa_id);
CREATE INDEX IF NOT EXISTS idx_org_dup_client    ON public.org_duplicato_validazione(client_id, stato);

-- ─── RLS ───────────────────────────────────────────────────────────────────────
-- org_dipendente: SEPARAZIONE GARANTITA DAL DB. RLS abilitata, NESSUNA policy di
-- SELECT/UPDATE/DELETE → qualsiasi connessione non-service_role (Data API, anon,
-- authenticated, futuro HR) NON può leggere né modificare l'anagrafica nominativa.
-- Solo service_role (app admin) accede pienamente.
ALTER TABLE public.org_dipendente ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.org_dipendente TO service_role;
REVOKE ALL ON public.org_dipendente FROM anon, authenticated;  -- niente accesso lato Data API

-- TEMPLATE FUTURO ACCESSO HR (da attivare quando esisterà un ruolo ristretto HR;
-- nessuna migration aggiuntiva, solo de-commentare). Scrittura SÌ, lettura MAI:
--   - INSERT solo su nome/data_ingresso/matricola (GRANT a livello colonna);
--   - riga della PROPRIA azienda + inserito_da forzato a 'hr' da trigger;
--   - nessuna policy SELECT/UPDATE/DELETE → lettura/modifica negate dal DB.
-- GRANT INSERT (nome, data_ingresso, matricola) ON public.org_dipendente TO authenticated;
-- CREATE OR REPLACE FUNCTION public.org_dip_hr_force() RETURNS trigger AS $$
-- BEGIN
--   NEW.inserito_da   := 'hr';
--   NEW.client_id     := (auth.jwt() -> 'app_metadata' ->> 'azienda_id');
--   NEW.attivo        := true;
--   NEW.straordinario := false;
--   NEW.data_cessazione := NULL;
--   NEW.identificativo_hr := NULL;
--   RETURN NEW;
-- END; $$ LANGUAGE plpgsql SECURITY DEFINER;
-- CREATE TRIGGER trg_org_dip_hr_force BEFORE INSERT ON public.org_dipendente
--   FOR EACH ROW WHEN (current_setting('role', true) <> 'service_role')
--   EXECUTE FUNCTION public.org_dip_hr_force();
-- CREATE POLICY org_dip_hr_insert ON public.org_dipendente
--   FOR INSERT TO authenticated
--   WITH CHECK (inserito_da = 'hr'
--               AND client_id = (auth.jwt() -> 'app_metadata' ->> 'azienda_id'));

-- Altre tabelle org_: backstop del progetto (RLS on, nessuna policy → non-service_role
-- negato). L'HR non le tocca mai; gli aggregati saranno esposti separatamente.
ALTER TABLE public.org_sessione_formativa      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_partecipazione_formativa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_duplicato_validazione   ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.org_sessione_formativa, public.org_partecipazione_formativa,
            public.org_duplicato_validazione TO service_role;
