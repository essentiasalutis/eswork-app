-- ============================================================================
-- v45 — Blocco 2.B: RPC atomica di completamento invito neoassunto
-- ============================================================================
-- La PARTE A RISCHIO. Hardening esplicito:
--  · SECURITY DEFINER + search_path='' (nomi schema-qualificati) → no injection.
--  · Firma whitelist: nessuno spread del body; client_id/tier risolti server-side dal
--    dipendente (mai dal caller); care_token generato QUI (assenza imposta, mai dal body).
--  · Esegue SOLO: consumo + crea paziente (record clinico + prova di consenso) + flip.
--  · Ritorna SOLO care_token (NULL se consumo fallito). dipendente_id resta interno,
--    mai ritornato né loggato accanto al care_token (vincolo #1 / regola dura D2).
--  · SELECT-eliminata a monte: il consumo atomico è l'UNICO gate; nessuna lettura
--    pre-consumo nell'endpoint. Vero per costruzione.
--
-- ATOMICITÀ DEL CONSENSO (2 guardie):
--  1. Il consenso è PARTE di "paziente creato". La INSERT in assessment_consents è nella
--     stessa transazione plpgsql: se fallisce, rollback TOTALE (consumo incluso → token
--     torna vivo). MAI un record clinico senza prova di consenso (dato sanitario senza
--     base giuridica). Nessun blocco EXCEPTION che ingoi l'errore: si lascia propagare.
--  2. informativa_version non-null per contratto: RAISE (→ rollback) se mancante.
--     Nessun default silenzioso. (L'endpoint la rifiuta già prima; questa è belt-and-braces.)
--
--  Consenso PATIENT-LINKED: SOLO su assessment_consents (patient_id + informativa_version,
--  v31; assessment_id nullable). NB: patients NON ha informativa_version. Nessun aggancio org
--  — il neoassunto entra nel modello di consenso ESISTENTE. Ponte impossibile per costruzione.
--
-- NB "risposte" (righe responses anonime) SALTATE di proposito: il KPI prevalenza NMQ del
--    Report Annuale viene da patients.level + reassessments_t12, NON da responses. Il
--    neoassunto è contato via patients.level; una riga responses inquinerebbe la coorte di
--    campagna. computeLevel resta in JS; qui scendono solo tier+prevention (soglie sotto).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consuma_invito_neoassunto(
  p_token_hash         text,
  p_computed_level     text,      -- da computeLevel(answers) in JS — logica clinica NON in plpgsql
  p_first_name         text,
  p_last_name          text,
  p_email              text,
  p_phone              text,
  p_location           text,
  p_wants_contacted    boolean,
  p_informativa_version text      -- versione del consenso accettata (prova legale)
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dip text; v_client_id text; v_employees int; v_tier text;
  v_prev boolean; v_level text; v_status text; v_care_token text; v_pid text; v_now timestamptz;
BEGIN
  -- Guardia 2: versione consenso obbligatoria. Nessun default silenzioso → RAISE (rollback).
  IF p_informativa_version IS NULL OR p_informativa_version = '' THEN
    RAISE EXCEPTION 'informativa_version mancante';
  END IF;

  -- (1) CONSUMO ATOMICO — UNICO gate. 0 righe (invalido/consumato/scaduto/revocato)
  --     → RETURN NULL: niente creato, l'endpoint risponde NEUTRO. Vincitore singolo
  --     sotto concorrenza (lock di riga); il perdente rivaluta e matcha 0 righe.
  UPDATE public.org_invito_token
     SET consumed_at = now()
   WHERE token_hash = p_token_hash
     AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  RETURNING dipendente_id INTO v_dip;
  IF v_dip IS NULL THEN
    RETURN NULL;
  END IF;

  -- (2) client_id + tier risolti dal dipendente consumato (MAI dal body).
  SELECT d.client_id, c.tier, c.employees
    INTO v_client_id, v_tier, v_employees
    FROM public.org_dipendente d
    JOIN public.clients c ON c.id = d.client_id
   WHERE d.id = v_dip;

  -- Bucket tier = clients.tier || soglia dipendenti. SPECCHIA pages/api/respond/[share_code].js:56.
  -- ⚠️ SOGLIE 150/500 DUPLICATE. Fonte canonica: lib/pricing/v1.js (tier_core_max=150,
  --    tier_plus_max=500). Se cambi qui, cambia anche là (e viceversa). Follow-up aperto:
  --    spostare le soglie in pricing_settings = fonte unica per JS + RPC (tampone consapevole).
  v_tier := COALESCE(v_tier,
    CASE WHEN v_employees <= 150 THEN 'core'
         WHEN v_employees <= 500 THEN 'plus'
         ELSE 'enterprise' END);
  v_prev := (p_computed_level = 'level2' AND v_tier IN ('plus','enterprise'));

  -- Livello/stato derivati da computed_level (paziente nuovo; specchia il flusso respond).
  IF p_computed_level = 'level1' THEN
    v_level := 'level1'; v_status := 'pending';   -- candidato pre-validazione, non confermato
  ELSIF p_computed_level = 'level2' THEN
    v_level := 'level2'; v_status := 'active';
  ELSE
    v_level := 'level3'; v_status := 'active';
  END IF;

  -- (3a) CREA PAZIENTE. care_token generato QUI (assenza imposta): 2× gen_random_uuid()
  --      = ~244 bit CSPRNG, core (pg_catalog, no pgcrypto → ok con search_path='').
  v_now        := now();
  v_care_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_pid        := 'pat_' || replace(gen_random_uuid()::text, '-', '');
  -- NB: informativa_version NON è su patients (v31 l'ha aggiunta ad assessment_consents).
  -- La prova di consenso (versione) vive SOLO su assessment_consents, patient-linked (3b).
  INSERT INTO public.patients
    (id, client_id, first_name, last_name, email, phone, location,
     level, level_status, computed_level, prevention_eligible,
     care_token, self_declared, wants_to_be_contacted,
     assessment_completed_at, created_at, updated_at)
  VALUES
    (v_pid, v_client_id, COALESCE(p_first_name, 'Anonimo'), COALESCE(p_last_name, ''),
     p_email, p_phone, p_location,
     v_level, v_status, p_computed_level, v_prev,
     v_care_token, true, COALESCE(p_wants_contacted, true),
     v_now, v_now, v_now);

  -- (3b) PROVA DI CONSENSO — stessa transazione (Guardia 1). Patient-linked (patient_id),
  --      assessment_id NULL (v31: "il consenso è legato al paziente"). Se questa INSERT
  --      fallisce, l'INTERA funzione rolla back: niente paziente senza consenso, token vivo.
  INSERT INTO public.assessment_consents
    (id, patient_id, consent_privacy_at, consent_health_at, informativa_version, created_at)
  VALUES
    ('ac_' || replace(gen_random_uuid()::text, '-', ''), v_pid, v_now, v_now, p_informativa_version, v_now);

  -- (4) FLIP flag →completato (guardato). NB: NESSUN patient_id/care_token scritto sul
  --     lato org; NESSUN dipendente_id scritto sul paziente. Il link org↔paziente vive
  --     solo in questa transazione e muore con lei (vincolo #1).
  UPDATE public.org_dipendente
     SET stato_invito_assessment = 'completato'
   WHERE id = v_dip AND stato_invito_assessment = 'invitato';

  RETURN v_care_token;   -- SOLO il care_token; dipendente_id mai ritornato/loggato
END;
$$;

-- Eseguibile SOLO da service_role (l'app la chiama server-side). Niente anon/authenticated.
REVOKE ALL ON FUNCTION public.consuma_invito_neoassunto(text,text,text,text,text,text,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consuma_invito_neoassunto(text,text,text,text,text,text,text,boolean,text) TO service_role;
