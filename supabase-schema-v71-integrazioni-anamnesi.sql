-- ============================================================================
-- v71 — Integrazioni dell'anamnesi (l'originale firmato non si riscrive)
-- ============================================================================
-- Decisioni di Enrico (18/9):
--   · una sola anamnesi: il documento firmato (patient_documents, type 'anamnesi');
--   · la firma copre SOLO l'originale: dopo la firma il suo contenuto non cambia più;
--   · ogni modifica dell'osteopata è un'INTEGRAZIONE: una riga per campo, con
--     osteopata, data, valore prima e valore dopo, e un MOTIVO obbligatorio (una riga
--     breve). Si può anche svuotare un campo: resta la riga, e l'originale si vede;
--   · solo l'osteopata assegnato integra (lo controlla il server);
--   · la versione corrente = originale + integrazioni in ordine di tempo.
--
-- Qui:
--   1. anamnesi_integrazioni: le righe NON si modificano. Si cancellano solo con la
--      procedura dell'amministratore, che parte solo fuori dal periodo di
--      conservazione (come copie_cartacee, v65).
--   2. patient_documents: un'anamnesi compilata o firmata non cambia più contenuto,
--      impronta, data della firma, firma o note. Seconda difesa, oltre al server.
--
-- Nessun dato da convertire: al 18/9 non esistono anamnesi di pazienti reali.
-- Idempotente.

-- ─── 1. Le integrazioni ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anamnesi_integrazioni (
  id               TEXT PRIMARY KEY,
  patient_id       TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  documento_id     TEXT NOT NULL REFERENCES public.patient_documents(id) ON DELETE CASCADE,
  professional_id  TEXT NOT NULL,                 -- chi ha integrato (senza FK: la prova resta)
  gruppo           TEXT NOT NULL,                 -- un salvataggio = un gruppo (stesso motivo)
  campo            TEXT NOT NULL CHECK (length(trim(campo)) > 0),
  valore_prima     JSONB,                         -- il valore corrente PRIMA di questa integrazione
  valore_dopo      JSONB,                         -- null o '' = campo svuotato
  motivo           TEXT NOT NULL CHECK (length(trim(motivo)) BETWEEN 3 AND 200),
  creato_il        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anamnesi_integrazioni_paziente ON public.anamnesi_integrazioni(patient_id, creato_il);

CREATE OR REPLACE FUNCTION public.anamnesi_integrazioni_immutabile() RETURNS trigger AS $f$
BEGIN
  RAISE EXCEPTION 'anamnesi_integrazioni: un''integrazione non si modifica (se ne aggiunge una nuova)';
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anamnesi_integrazioni_no_update ON public.anamnesi_integrazioni;
CREATE TRIGGER anamnesi_integrazioni_no_update BEFORE UPDATE ON public.anamnesi_integrazioni
  FOR EACH ROW EXECUTE FUNCTION public.anamnesi_integrazioni_immutabile();

ALTER TABLE public.anamnesi_integrazioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.anamnesi_integrazioni FROM anon, authenticated;
GRANT ALL ON public.anamnesi_integrazioni TO service_role;

-- ─── 2. L'originale firmato non cambia ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.anamnesi_originale_immutabile() RETURNS trigger AS $f$
BEGIN
  IF OLD.type = 'anamnesi' AND OLD.status IN ('completed', 'signed') AND (
       NEW.form_data       IS DISTINCT FROM OLD.form_data
    OR NEW.content_hash    IS DISTINCT FROM OLD.content_hash
    OR NEW.signed_at       IS DISTINCT FROM OLD.signed_at
    OR NEW.signature_image IS DISTINCT FROM OLD.signature_image
    OR NEW.pro_notes       IS DISTINCT FROM OLD.pro_notes
  ) THEN
    RAISE EXCEPTION 'patient_documents: l''anamnesi firmata non si riscrive (le modifiche sono integrazioni, tabella anamnesi_integrazioni)';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anamnesi_originale_no_update ON public.patient_documents;
CREATE TRIGGER anamnesi_originale_no_update BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION public.anamnesi_originale_immutabile();

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT count(*) FROM public.anamnesi_integrazioni;                                    -- 0
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.anamnesi_integrazioni'::regclass AND NOT tgisinternal;   -- anamnesi_integrazioni_no_update
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.patient_documents'::regclass AND tgname = 'anamnesi_originale_no_update';
