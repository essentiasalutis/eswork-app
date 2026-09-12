-- v60 — Validazione registrata dei report
--
-- Finché la validazione non è registrata, nessun documento la dichiara (decisione del
-- 12/9: su un documento sanitario non si stampa ciò che non si può dimostrare).
-- Con queste colonne il fatto esiste: chi ha validato, quando — e se ha revocato.
--
-- `validato_da` / `validato_il` = STATO CORRENTE (vuoti = non validato / revocato).
-- `validazioni` = SEQUENZA degli eventi, mai riscritta:
--   [{"azione":"validato","chi":"Dott. …","quando":"2026-09-12T…"},
--    {"azione":"revocato","chi":"Dott. …","quando":"2026-09-13T…"}]
-- Serve il caso vero: un documento validato, uscito verso un cliente e poi
-- de-validato. Lo stato dice com'è adesso, la sequenza dice cosa è successo.
--
-- Un report RIGENERATO non eredita nulla: la rigenerazione crea una nuova riga in
-- generated_reports, e un testo nuovo non è quello che è stato validato.

ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS validato_da TEXT;
ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS validato_il TIMESTAMPTZ;
ALTER TABLE public.generated_reports ADD COLUMN IF NOT EXISTS validazioni JSONB;

-- Nome che compare nella riga di validazione: modificabile dal Listino v2.
INSERT INTO public.pricing_settings (version, key, value) VALUES
  ('v2','validatore_nome','Dott. Enrico Maiolo (osteopata)')
ON CONFLICT (version, key) DO NOTHING;
