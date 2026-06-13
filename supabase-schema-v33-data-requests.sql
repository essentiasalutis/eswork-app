-- ─── ES Work — Schema v33: Diritti GDPR esercitabili (BLOCCO 5) ──────────────
-- Richieste dell'interessato (accesso/rettifica/cancellazione/revoca consenso)
-- tracciate e gestite dal titolare. + flag di revoca del consenso sul paziente.

CREATE TABLE IF NOT EXISTS public.data_requests (
  id            TEXT PRIMARY KEY,
  patient_id    TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id     TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('access','rectification','erasure','consent_withdrawal')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','rejected')),
  note          TEXT,            -- testo dell'interessato (cosa chiede)
  response_note TEXT,            -- esito/risposta del titolare
  processed_by  TEXT,
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_status  ON public.data_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_requests_patient ON public.data_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_created ON public.data_requests(created_at DESC);

-- Revoca del consenso: timestamp sul paziente (null = consenso attivo).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ;
