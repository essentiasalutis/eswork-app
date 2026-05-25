-- ============================================================
-- supabase-schema-v15-admin.sql
-- Settings admin + coorti waitlist
-- DA ESEGUIRE: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Impostazioni admin configurabili
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  label       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valori default (upsert-safe)
INSERT INTO public.admin_settings (key, value, label, description) VALUES
  ('hourly_rate',               '60',    'Costo orario (€)',          'Costo orario professionista in euro'),
  ('sessions_intensive',        '5',     'Sessioni intensive Y1',     'Sessioni osteo primi 2 mesi per paziente L1'),
  ('sessions_maintenance',      '5',     'Sessioni mantenimento Y1',  'Sessioni osteo mesi 3-10 per paziente L1'),
  ('sessions_prevention_y2',    '5',     'Sessioni prevenzione Y2',   'Sessioni annue per paziente L2'),
  ('sessions_maintenance_y2',   '6',     'Sessioni mantenimento Y2',  'Sessioni annue per ex-L1 anno 2+'),
  ('completion_rate',           '0.75',  'Tasso completamento',       'Percentuale pazienti che completano il protocollo'),
  ('max_cycles_per_year',       '2',     'Max cicli L1/anno',         'Numero massimo di cicli di trattamento per paziente'),
  ('sessions_per_cycle',        '4',     'Sessioni per ciclo',        'Sessioni per ciclo di trattamento L1'),
  ('min_gap_between_cycles',    '60',    'Gap minimo tra cicli (gg)', 'Giorni minimi tra la fine di un ciclo e l''inizio del successivo'),
  ('buffer_pct',                '0.15',  'Buffer ri-stratificazione', 'Percentuale sessioni buffer per nuovi L1 (es. 0.15 = 15%)'),
  ('max_acute_events_per_year', '2',     'Max eventi acuti/anno',     'Numero massimo di eventi acuti segnalabili per paziente per anno'),
  ('margin_y1',                 '0.43',  'Margine Anno 1',            'Margine lordo Anno 1 (es. 0.43 = 43%)'),
  ('margin_y2',                 '0.48',  'Margine Anno 2+',           'Margine lordo Anno 2+ (es. 0.48 = 48%)'),
  ('tier_core_max',             '150',   'Soglia Core (max dip)',      'Numero massimo dipendenti per tier Core'),
  ('tier_plus_max',             '500',   'Soglia Plus (max dip)',      'Numero massimo dipendenti per tier Plus (oltre = Enterprise)')
ON CONFLICT (key) DO NOTHING;

-- Colonna coorte nella waitlist
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS cohort INTEGER CHECK (cohort >= 1 AND cohort <= 4);
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS cohort_start_date DATE;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS assigned_professional_id TEXT REFERENCES public.professionals(id);

-- Log report generati
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_type  TEXT NOT NULL CHECK (report_type IN ('activation','checkpoint_t3','checkpoint_t6','annual_t12','quote')),
  content_text TEXT,
  checkpoint   TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_client ON public.generated_reports(client_id);

GRANT ALL ON public.admin_settings TO service_role;
GRANT ALL ON public.generated_reports TO service_role;
