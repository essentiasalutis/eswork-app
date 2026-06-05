-- ES Work — Schema v21
-- BLOCCO C — Self-trigger strutturato (consolida la vecchia logica "evento acuto").
--
-- Canale unico di auto-segnalazione per L2/L3 (e L1 a fine ciclo). Max 2/anno.
-- Mini-triage SENZA NRS (l'NRS lo rileva l'osteopata in videochiamata).
-- Il flag urgent ingloba la priorità del vecchio "evento acuto".

CREATE TABLE IF NOT EXISTS public.self_triggers (
  id                 TEXT PRIMARY KEY,
  patient_id         TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  client_id          TEXT REFERENCES public.clients(id),
  disturbance        TEXT,                         -- presenza/tipo di disturbo
  functional_impact  BOOLEAN,                      -- impatto sulle attività
  duration           TEXT,                         -- da quanto tempo
  urgent             BOOLEAN NOT NULL DEFAULT FALSE,-- caso acuto → priorità
  note               TEXT,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','prevalidated','closed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_triggers_patient ON public.self_triggers(patient_id);
CREATE INDEX IF NOT EXISTS idx_self_triggers_client  ON public.self_triggers(client_id);

-- waitlist.source: consenti i nuovi valori del modello v4 (self_trigger, self_declaration)
ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_source_check;
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_source_check
  CHECK (source IN ('assessment','minicheck','acute_event','restratification','self_trigger','self_declaration'));
