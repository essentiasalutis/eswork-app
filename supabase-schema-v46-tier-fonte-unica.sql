-- ============================================================================
-- v46 — Tier: fonte unica (Follow-up #1, variante B)
-- ============================================================================
-- (a) Aggiunge le soglie tier CORRENTI a pricing_settings (v2).
-- (b) CREATE OR REPLACE della RPC del neoassunto: legge le soglie da pricing_settings
--     invece di hardcodare 150/500 (fallback 150/500 se assenti). Supera la versione in
--     supabase-schema-v45-invito-rpc.sql (quel file resta storico; QUESTA è la corrente).
--
-- Lato JS la soglia CORRENTE vive in lib/pricing/tier.js (TIER_CORE_MAX/TIER_PLUS_MAX).
-- scripts/check-tier-consistency.mjs asserisce pricing_settings == costante JS → un cambio
-- a metà FALLISCE invece di passare in silenzio. (lib/pricing/v1.js resta congelato, a parte.)
-- ============================================================================

-- (a) soglie tier in pricing_settings (non sovrascrive se già presenti)
INSERT INTO public.pricing_settings (version, key, value) VALUES
  ('v2','tier_core_max','150'),
  ('v2','tier_plus_max','500')
ON CONFLICT (version, key) DO NOTHING;

-- (b) RPC che legge le soglie da pricing_settings
CREATE OR REPLACE FUNCTION public.consuma_invito_neoassunto(
  p_token_hash          text,
  p_computed_level      text,
  p_first_name          text,
  p_last_name           text,
  p_email               text,
  p_phone               text,
  p_location            text,
  p_wants_contacted     boolean,
  p_informativa_version text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dip text; v_client_id text; v_employees int; v_tier text;
  v_core_max int; v_plus_max int;
  v_prev boolean; v_level text; v_status text; v_care_token text; v_pid text; v_now timestamptz;
BEGIN
  IF p_informativa_version IS NULL OR p_informativa_version = '' THEN
    RAISE EXCEPTION 'informativa_version mancante';
  END IF;

  UPDATE public.org_invito_token
     SET consumed_at = now()
   WHERE token_hash = p_token_hash
     AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  RETURNING dipendente_id INTO v_dip;
  IF v_dip IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT d.client_id, c.tier, c.employees
    INTO v_client_id, v_tier, v_employees
    FROM public.org_dipendente d
    JOIN public.clients c ON c.id = d.client_id
   WHERE d.id = v_dip;

  -- Soglie tier da pricing_settings (FONTE UNICA; fallback 150/500). Bucket = clients.tier || soglia.
  v_core_max := COALESCE((SELECT value::int FROM public.pricing_settings WHERE version='v2' AND key='tier_core_max'), 150);
  v_plus_max := COALESCE((SELECT value::int FROM public.pricing_settings WHERE version='v2' AND key='tier_plus_max'), 500);
  v_tier := COALESCE(v_tier,
    CASE WHEN v_employees <= v_core_max THEN 'core'
         WHEN v_employees <= v_plus_max THEN 'plus'
         ELSE 'enterprise' END);
  v_prev := (p_computed_level = 'level2' AND v_tier IN ('plus','enterprise'));

  IF p_computed_level = 'level1' THEN
    v_level := 'level1'; v_status := 'pending';
  ELSIF p_computed_level = 'level2' THEN
    v_level := 'level2'; v_status := 'active';
  ELSE
    v_level := 'level3'; v_status := 'active';
  END IF;

  v_now        := now();
  v_care_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_pid        := 'pat_' || replace(gen_random_uuid()::text, '-', '');
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

  INSERT INTO public.assessment_consents
    (id, patient_id, consent_privacy_at, consent_health_at, informativa_version, created_at)
  VALUES
    ('ac_' || replace(gen_random_uuid()::text, '-', ''), v_pid, v_now, v_now, p_informativa_version, v_now);

  UPDATE public.org_dipendente
     SET stato_invito_assessment = 'completato'
   WHERE id = v_dip AND stato_invito_assessment = 'invitato';

  RETURN v_care_token;
END;
$$;

REVOKE ALL ON FUNCTION public.consuma_invito_neoassunto(text,text,text,text,text,text,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consuma_invito_neoassunto(text,text,text,text,text,text,text,boolean,text) TO service_role;
