-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-schema-v38-pricing-v2.sql
-- Versionamento del listino: le aziende ESISTENTI restano sul modello v1
-- (formule congelate nel codice, lib/pricing/v1), le NUOVE nascono v2.
-- REQUISITO #1: nessuna regressione numerica sui clienti esistenti.
--
-- COME ESEGUIRE: incolla tutto nel SQL Editor di Supabase ed esegui.
-- Idempotente: rieseguirla non causa errori e NON riporta a v1 aziende nate v2
-- (il 3-step su pricing_version tocca solo le righe ancora NULL).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Versione listino per azienda ─────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS pricing_version TEXT CHECK (pricing_version IN ('v1','v2'));

-- TUTTE le aziende esistenti restano sul modello attuale (v1)
UPDATE public.clients SET pricing_version = 'v1' WHERE pricing_version IS NULL;

-- Le nuove aziende nascono v2
ALTER TABLE public.clients ALTER COLUMN pricing_version SET DEFAULT 'v2';
ALTER TABLE public.clients ALTER COLUMN pricing_version SET NOT NULL;

-- ── 2. Parametri v2 configurabili (globali, admin) ───────────────────────────
-- La v1 resta congelata NEL CODICE e non compare mai qui: impossibile
-- modificarla da UI. Solo fattori primitivi, mai valori derivati: i costi
-- si calcolano (es. ergonomia ufficio = minuti/60 × tariffa oraria sportello
-- del cliente — la tariffa NON è duplicata qui).
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  version    TEXT NOT NULL CHECK (version IN ('v2')),
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (version, key)
);

INSERT INTO public.pricing_settings (version, key, value) VALUES
  ('v2','l2_multiplier','2'),
  ('v2','prevention_sessions_per_l2','4'),
  ('v2','tariffa_sessione_prevenzione','60'),
  ('v2','buffer_pct','0.20'),
  ('v2','capienza_aula','25'),
  ('v2','ergonomia_minuti_persona','10'),      -- ufficio: 10' × tariffa/h sportello (100 pers × 10/60 × 120 = €2.000)
  ('v2','ergonomia_minuti_postazione','60')    -- produzione: 60' × tariffa/h sportello, per postazione tipo (dettaglio blocco 2)
ON CONFLICT (version, key) DO NOTHING;

-- ── 3. Servizi & deliverable (valori dichiarati per configurazione) ─────────
-- "configurazione" = Core/Plus/Enterprise: nomi INTERNI, mai cliente-facing.
-- Nei documenti cliente compaiono solo le voci con i valori dichiarati:
-- MAI un totale-valori, MAI "in omaggio/compreso gratuitamente", MAI "AI".
CREATE TABLE IF NOT EXISTS public.servizi_deliverable (
  id                TEXT PRIMARY KEY,
  voce              TEXT NOT NULL,
  configurazione    TEXT NOT NULL CHECK (configurazione IN ('core','plus','enterprise')),
  valore_dichiarato NUMERIC NOT NULL,
  ordine            INTEGER NOT NULL DEFAULT 0,
  attivo            BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (voce, configurazione)
);

INSERT INTO public.servizi_deliverable (id, voce, configurazione, valore_dichiarato, ordine) VALUES
  ('sd_piattaforma_core','Piattaforma digitale ES Work','core',800,1),
  ('sd_piattaforma_plus','Piattaforma digitale ES Work','plus',1200,1),
  ('sd_piattaforma_ent','Piattaforma digitale ES Work','enterprise',2000,1),
  ('sd_report_core','Reportistica (Attivazione + 2 Review + Annuale)','core',600,2),
  ('sd_report_plus','Reportistica (Attivazione + 2 Review + Annuale)','plus',1800,2),
  ('sd_report_ent','Reportistica (Attivazione + 2 Review + Annuale)','enterprise',4000,2),
  ('sd_coord_core','Coordinamento e regia','core',400,3),
  ('sd_coord_plus','Coordinamento e regia','plus',1500,3),
  ('sd_coord_ent','Coordinamento e regia','enterprise',5500,3),
  ('sd_ot23_core','Documentazione OT23 INAIL','core',500,4),
  ('sd_ot23_plus','Documentazione OT23 INAIL','plus',500,4),
  ('sd_ot23_ent','Documentazione OT23 INAIL','enterprise',500,4)
ON CONFLICT (id) DO NOTHING;

-- ── 4. RLS (convenzione progetto: enable senza policy = anon/auth negati) ────
-- Lezione v33/data_requests: MAI creare tabelle senza abilitare la RLS.
ALTER TABLE public.pricing_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servizi_deliverable ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.pricing_settings    TO service_role;
GRANT ALL ON public.servizi_deliverable TO service_role;

-- ── Verifica post-esecuzione ─────────────────────────────────────────────────
-- SELECT pricing_version, COUNT(*) FROM public.clients GROUP BY pricing_version;
--   → tutte le esistenti 'v1'; nessuna NULL.
-- SELECT COUNT(*) FROM public.pricing_settings;    → 7
-- SELECT COUNT(*) FROM public.servizi_deliverable; → 12
