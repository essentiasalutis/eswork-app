-- ============================================================================
-- v65 — Copia cartacea del consenso (punto d)
-- ============================================================================
-- Decisioni di Enrico (17/9):
--   • la firma in piattaforma è la regola, la carta l'eccezione — con MOTIVO
--     obbligatorio, per vedere se l'eccezione sta diventando la regola;
--   • la copia vale solo se l'osteopata indica la versione dall'ARCHIVIO (v64),
--     in vigore alla data della firma, e la carica entro 7 GIORNI dalla data
--     dichiarata della firma. Oltre, o senza versione, il documento va rifatto;
--   • la copia si conserva con la documentazione clinica.
--
-- Nessuno stato intermedio: la riga in patient_documents si scrive SOLO dopo che
-- il server ha accettato il file. Un file caricato e poi rifiutato non lascia
-- traccia di «firmato» (e viene rimosso dall'area di transito).
--
-- Dipende da v64 (testi_legali). Idempotente.

-- ─── 1. Il documento corrente sa com'è stato firmato ─────────────────────────
ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS modalita          TEXT NOT NULL DEFAULT 'piattaforma',
  ADD COLUMN IF NOT EXISTS carta_data_firma  DATE,        -- dichiarata dall'osteopata (giorno italiano; i 7 giorni si contano in Europe/Rome)
  ADD COLUMN IF NOT EXISTS carta_motivo      TEXT,
  ADD COLUMN IF NOT EXISTS carta_motivo_nota TEXT,
  ADD COLUMN IF NOT EXISTS file_path         TEXT,        -- bucket privato patient-documents
  ADD COLUMN IF NOT EXISTS file_mime         TEXT,
  ADD COLUMN IF NOT EXISTS file_bytes        INTEGER,
  ADD COLUMN IF NOT EXISTS file_impronta     TEXT,        -- SHA-256 calcolato dal SERVER
  ADD COLUMN IF NOT EXISTS caricato_il       TIMESTAMPTZ; -- orologio del server

ALTER TABLE public.patient_documents DROP CONSTRAINT IF EXISTS patient_documents_modalita_chk;
ALTER TABLE public.patient_documents ADD CONSTRAINT patient_documents_modalita_chk
  CHECK (modalita IN ('piattaforma', 'carta'));

ALTER TABLE public.patient_documents DROP CONSTRAINT IF EXISTS patient_documents_carta_motivo_chk;
ALTER TABLE public.patient_documents ADD CONSTRAINT patient_documents_carta_motivo_chk
  CHECK (carta_motivo IS NULL OR carta_motivo IN
    ('tablet_non_disponibile', 'connessione_assente', 'preferenza_paziente', 'altro'));

-- Una copia su carta è completa o non esiste: versione d'archivio, data, motivo
-- (con nota se «altro»), file e impronta del file, data di caricamento.
ALTER TABLE public.patient_documents DROP CONSTRAINT IF EXISTS patient_documents_carta_completa_chk;
ALTER TABLE public.patient_documents ADD CONSTRAINT patient_documents_carta_completa_chk
  CHECK (modalita <> 'carta' OR (
        type IN ('consent_treatment', 'privacy_extended')
    AND testo_legale_id IS NOT NULL
    AND carta_data_firma IS NOT NULL
    AND carta_motivo IS NOT NULL
    AND (carta_motivo <> 'altro' OR length(coalesce(carta_motivo_nota, '')) >= 5)
    AND file_path IS NOT NULL
    AND file_impronta IS NOT NULL
    AND caricato_il IS NOT NULL
    AND (caricato_il AT TIME ZONE 'Europe/Rome')::date - carta_data_firma BETWEEN 0 AND 7
  ));

-- ─── 2. Tutte le copie caricate, anche quelle poi sostituite ─────────────────
-- patient_documents tiene la copia CORRENTE; qui restano tutte, con il percorso
-- del file (che non si cancella mai alla sostituzione). Nessuna modifica ammessa.
-- La cancellazione resta possibile solo per la procedura di conservazione
-- dell'amministratore, insieme al paziente.
CREATE TABLE IF NOT EXISTS public.copie_cartacee (
  id               TEXT PRIMARY KEY,
  patient_id       TEXT NOT NULL,
  client_id        TEXT NOT NULL,
  professional_id  TEXT NOT NULL,
  documento        TEXT NOT NULL CHECK (documento IN ('consent_treatment', 'privacy_extended')),
  testo_legale_id  TEXT NOT NULL REFERENCES public.testi_legali(id),
  versione         TEXT NOT NULL,
  data_firma       DATE NOT NULL,
  motivo           TEXT NOT NULL CHECK (motivo IN
                     ('tablet_non_disponibile', 'connessione_assente', 'preferenza_paziente', 'altro')),
  motivo_nota      TEXT,
  file_path        TEXT NOT NULL,
  file_mime        TEXT NOT NULL,
  file_bytes       INTEGER NOT NULL,
  file_impronta    TEXT NOT NULL,
  caricato_il      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (motivo <> 'altro' OR length(coalesce(motivo_nota, '')) >= 5),
  CHECK ((caricato_il AT TIME ZONE 'Europe/Rome')::date - data_firma BETWEEN 0 AND 7)
);
CREATE INDEX IF NOT EXISTS idx_copie_cartacee_patient ON public.copie_cartacee(patient_id);
CREATE INDEX IF NOT EXISTS idx_copie_cartacee_pro     ON public.copie_cartacee(professional_id);

CREATE OR REPLACE FUNCTION public.copie_cartacee_immutabile() RETURNS trigger AS $f$
BEGIN
  RAISE EXCEPTION 'copie_cartacee: una copia caricata non si modifica (se ne carica una nuova)';
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS copie_cartacee_no_update ON public.copie_cartacee;
CREATE TRIGGER copie_cartacee_no_update BEFORE UPDATE ON public.copie_cartacee
  FOR EACH ROW EXECUTE FUNCTION public.copie_cartacee_immutabile();

ALTER TABLE public.copie_cartacee ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.copie_cartacee FROM anon, authenticated;
GRANT ALL ON public.copie_cartacee TO service_role;

-- ─── 3. Cartella di archiviazione PRIVATA per i documenti clinici ────────────
-- Separata da pro-documents (dati del professionista, art. 6.1.b): qui ci sono
-- dati sanitari. Non pubblica; limite 10 MB; solo PDF, JPG, PNG. L'app accede col
-- service_role tramite link firmati a breve scadenza.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('patient-documents', 'patient-documents', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'patient_documents' AND column_name IN ('modalita','file_impronta');
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'patient-documents';
-- SELECT count(*) FROM public.copie_cartacee;
