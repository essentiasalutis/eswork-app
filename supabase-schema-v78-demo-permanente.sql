-- ============================================================================
-- v78 — Azienda demo permanente per le presentazioni dal vivo
-- ============================================================================
-- Decisioni di Enrico (21/9). Ai convegni la sala compila il check-up da un QR e si
-- mostra dal vivo il report di Attivazione. Serve un'azienda demo che non si
-- cancella mai e che si azzera a ogni evento.
--
--   · UNA sola azienda può essere «demo permanente», ed è sempre anche is_demo;
--   · non si cancella e non smette di essere demo permanente;
--   · l'azzeramento è una funzione che si RIFIUTA per qualunque altra azienda: il
--     controllo sta qui, non solo nella pagina e nell'API;
--   · registro dei consensi: eccezione SOLO per le persone di questa demo (non per
--     Officine né per le altre demo), più le schermate di consenso della demo
--     rimaste senza persona (canale 'checkup_demo');
--   · interruttore della parte economica del report (demo_mostra_prezzo).
-- Dipende da v64 (consensi_registrati), v73 (mc_e_demo), v76 (eccezioni demo di
-- sedute e registro accessi). Idempotente.

-- ─── 1. Colonne ──────────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS demo_permanente   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_mostra_prezzo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_demo_permanente_e_demo;
ALTER TABLE public.clients ADD CONSTRAINT clients_demo_permanente_e_demo CHECK (NOT demo_permanente OR is_demo);

-- Al massimo una.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_demo_permanente ON public.clients (demo_permanente) WHERE demo_permanente;

CREATE OR REPLACE FUNCTION public.demo_e_permanente(p_client TEXT) RETURNS boolean AS $f$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client AND demo_permanente AND is_demo);
$f$ LANGUAGE sql STABLE;

-- ─── 2. Non si cancella, non smette di essere demo permanente ────────────────
CREATE OR REPLACE FUNCTION public.clients_demo_permanente_protetta() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.demo_permanente THEN RAISE EXCEPTION 'clients: l''azienda demo permanente non si cancella'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.demo_permanente AND (NOT NEW.demo_permanente OR NOT NEW.is_demo) THEN
    RAISE EXCEPTION 'clients: l''azienda demo permanente resta demo permanente';
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS clients_demo_permanente_trg ON public.clients;
CREATE TRIGGER clients_demo_permanente_trg BEFORE UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_demo_permanente_protetta();

-- ─── 3. Registro dei consensi: eccezione per la sola demo permanente ─────────
-- Stessa funzione di v64, con UNA aggiunta nel ramo DELETE.
CREATE OR REPLACE FUNCTION public.consensi_solo_aggiunta() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Unica eccezione: sessioni mai collegate a nessuno (check-up abbandonati),
    -- che non contengono dati personali.
    IF OLD.soggetto_id IS NULL THEN RETURN OLD; END IF;
    -- v78: persone della demo permanente (azzeramento a ogni evento).
    IF OLD.soggetto_tipo = 'paziente' AND EXISTS (
      SELECT 1 FROM public.patients p WHERE p.id = OLD.soggetto_id AND public.demo_e_permanente(p.client_id)
    ) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'consensi_registrati: un consenso registrato non si cancella';
  END IF;
  -- UPDATE: ammesso SOLO il collegamento della sessione al soggetto, una volta.
  IF OLD.soggetto_id IS NULL AND NEW.soggetto_id IS NOT NULL
     AND NEW.consenso = OLD.consenso AND NEW.valore = OLD.valore
     AND NEW.testo_legale_id = OLD.testo_legale_id AND NEW.impronta = OLD.impronta
     AND NEW.versione = OLD.versione AND NEW.atto_at = OLD.atto_at
     AND NEW.sessione_id IS NOT DISTINCT FROM OLD.sessione_id THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'consensi_registrati: solo in aggiunta (la revoca è una riga nuova)';
END $f$ LANGUAGE plpgsql;

-- ─── 4. Azzeramento ──────────────────────────────────────────────────────────
-- Una transazione: o tutto o niente. Si rifiuta per qualunque azienda che non sia la
-- demo permanente. Riapre un check-up nuovo, senza data di chiusura.
CREATE OR REPLACE FUNCTION public.azzera_demo_permanente(p_client TEXT) RETURNS jsonb AS $f$
DECLARE
  n_persone INTEGER; n_risposte INTEGER; n_consensi INTEGER; n_report INTEGER; n_registro INTEGER;
  nuovo_id TEXT;
BEGIN
  IF NOT public.demo_e_permanente(p_client) THEN
    RAISE EXCEPTION 'azzeramento: consentito solo per l''azienda demo permanente';
  END IF;

  DELETE FROM public.consensi_registrati c
   WHERE c.soggetto_tipo = 'paziente'
     AND c.soggetto_id IN (SELECT id FROM public.patients WHERE client_id = p_client);
  GET DIAGNOSTICS n_consensi = ROW_COUNT;
  DELETE FROM public.consensi_registrati WHERE soggetto_id IS NULL AND canale = 'checkup_demo';

  DELETE FROM public.access_logs WHERE patient_id IN (SELECT id FROM public.patients WHERE client_id = p_client);
  GET DIAGNOSTICS n_registro = ROW_COUNT;

  DELETE FROM public.assessment_consents
   WHERE patient_id IN (SELECT id FROM public.patients WHERE client_id = p_client)
      OR assessment_id IN (SELECT id FROM public.assessments WHERE client_id = p_client);
  DELETE FROM public.responses WHERE assessment_id IN (SELECT id FROM public.assessments WHERE client_id = p_client);
  GET DIAGNOSTICS n_risposte = ROW_COUNT;

  DELETE FROM public.waitlist WHERE client_id = p_client;
  DELETE FROM public.restratification_alerts WHERE client_id = p_client;
  DELETE FROM public.patients WHERE client_id = p_client;       -- a cascata il resto della persona
  GET DIAGNOSTICS n_persone = ROW_COUNT;

  DELETE FROM public.generated_reports WHERE client_id = p_client;
  GET DIAGNOSTICS n_report = ROW_COUNT;
  DELETE FROM public.documents WHERE client_id = p_client;
  DELETE FROM public.forbice_revisioni WHERE client_id = p_client;
  DELETE FROM public.referral_codes WHERE client_id = p_client;
  DELETE FROM public.assessments WHERE client_id = p_client;

  UPDATE public.first_meetings SET stima_snapshot = NULL, updated_at = now() WHERE client_id = p_client;

  nuovo_id := 'demo_ck_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  INSERT INTO public.assessments (id, client_id, type, status, share_code, created_at)
  VALUES (nuovo_id, p_client, 'initial', 'active', 'DEMO' || upper(substr(md5(random()::text), 1, 8)), now());

  RETURN jsonb_build_object('persone', n_persone, 'risposte', n_risposte, 'consensi', n_consensi,
                            'report', n_report, 'registro', n_registro, 'checkup', nuovo_id);
END $f$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.azzera_demo_permanente(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.azzera_demo_permanente(TEXT) TO service_role;

-- ─── 5. L'azienda demo permanente ────────────────────────────────────────────
-- Codice del check-up FISSO: il QR non cambia da un evento all'altro.
INSERT INTO public.clients (id, name, sector, employees, pipeline_stage, source, pricing_version, tipo_prodotto,
                            is_demo, demo_permanente, demo_mostra_prezzo, assessment_share_code, created_at)
VALUES ('demo_permanente', 'Azienda Dimostrativa', 2, 30, 'assessment_sent', 'demo', 'v2', 'programma_completo',
        true, true, true, 'DEMOLIVE01', now())
ON CONFLICT (id) DO NOTHING;

-- Scheda del colloquio con le tariffe standard: serve alla parte economica del report.
INSERT INTO public.first_meetings (id, client_id, employees, sector, data, created_at, updated_at)
SELECT 'demo_permanente_fm', 'demo_permanente', 30, 2, jsonb_build_object(
  'step1', jsonb_build_object('nome', 'Azienda Dimostrativa', 'sector', 'services', 'disturbi', '[]'::jsonb),
  'step2', jsonb_build_object('sedi', jsonb_build_array(jsonb_build_object('nome', 'Sede principale', 'employees', 30)),
                              'capienza', 25, 'training_mode', 'per_sede',
                              'ergonomia_ufficio_auto', true, 'ergonomia_addetti', 0, 'ergonomia_postazioni', 0),
  'params', jsonb_build_object('l2_mult', 2, 'vat_exempt', true, 'rates', jsonb_build_object(
    'sportello_sell', 120, 'sportello_cost', 60, 'prevalidation_sell', 30, 'prevalidation_cost', 15,
    'training_sell', 250, 'training_cost', 100))), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.first_meetings WHERE client_id = 'demo_permanente');

-- Primo check-up aperto.
INSERT INTO public.assessments (id, client_id, type, status, share_code, created_at)
SELECT 'demo_ck_iniziale', 'demo_permanente', 'initial', 'active', 'DEMOCK0001', now()
WHERE NOT EXISTS (SELECT 1 FROM public.assessments WHERE client_id = 'demo_permanente');

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT id, name, is_demo, demo_permanente, assessment_share_code FROM public.clients WHERE demo_permanente;  -- 1 riga
-- Prova senza effetti su un'altra azienda (deve dare errore, nulla viene toccato):
-- SELECT public.azzera_demo_permanente('dmo_officine');
--   → ERRORE «azzeramento: consentito solo per l'azienda demo permanente»
