-- ============================================================================
-- v43 — Blocco 2 (clinica del neoassunto): token d'invito monouso a bassa autorità
-- ============================================================================
-- NB numeri: v42 è RISERVATO al follow-up "parità REVOKE anon" sulle 3 tabelle org
-- sorelle (org_sessione_formativa / org_partecipazione_formativa /
-- org_duplicato_validazione) — follow-up APPROVATO e ancora da fare, non evaporato.
-- Il TOCTOU del rate-limit HR è l'altro follow-up aperto (numero successivo).
-- Questa migration fa REVOKE solo su org_invito_token: la parità REVOKE resta a parte.
-- ============================================================================
-- VINCOLO #1 (non-ricongiungimento): org_invito_token conosce SOLO dipendente_id.
-- MAI patient_id, MAI care_token, MAI alcun identificatore clinico. Per costruzione.
-- Il link org->paziente vive solo dentro la request e muore con lei.
--
-- Questa migration copre il BLOCCO 2.A (lato admin: genera/revoca invito, flip
-- del flag ->invitato). L'RPC di completamento atomico (consume+crea+risposte+flip)
-- arriva con la migration del Blocco 2.B.
--
-- NOTA scelta: token-in-path (bassa autorità, one-shot), plaintext MAI salvato —
-- si salva solo lo SHA-256. Consumo atomico al submit (Blocco 2.B).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.org_invito_token (
  token_hash    text PRIMARY KEY,                               -- SHA-256(hex) del token; plaintext MAI salvato
  dipendente_id text NOT NULL REFERENCES public.org_dipendente(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,                          -- created_at + 14 giorni
  consumed_at   timestamptz,                                    -- settato ATOMICAMENTE al submit (2.B)
  revoked_at    timestamptz                                     -- revoca admin (link morto, risposta neutra)
  -- NESSUN patient_id. NESSUN care_token. Nessuna colonna verso il clinico.
);

-- Lookup admin "inviti di questo dipendente" (audit ORG-side: solo dipendente_id).
CREATE INDEX IF NOT EXISTS idx_org_invito_token_dip
  ON public.org_invito_token(dipendente_id);

-- Invariante: al più UN token VIVO per dipendente (chiude il doppio-token concorrente
-- -> doppio-paziente). Riferisce solo dipendente_id -> vincolo-safe.
-- NB: NON copre la ri-emissione sequenziale dopo 'completato'/consumo: quella la
-- gestisce la guardia applicativa in 2.A (rifiuta salvo override esplicito).
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invito_token_live
  ON public.org_invito_token(dipendente_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

-- Backstop RLS come le altre tabelle org: nessun accesso anon/authenticated; solo
-- service_role (l'app usa la service key server-side). Belt-and-suspenders esplicito.
ALTER TABLE public.org_invito_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_invito_token FROM anon, authenticated;
GRANT ALL ON public.org_invito_token TO service_role;

-- Verifica (read-only) dopo l'applicazione:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_name='org_invito_token' ORDER BY ordinal_position;
--   -> attese 6 colonne: token_hash, dipendente_id, created_at, expires_at, consumed_at, revoked_at
