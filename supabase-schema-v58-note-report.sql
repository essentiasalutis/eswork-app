-- v58 — Nota in fondo ai report: due varianti, nessuna validazione dichiarata
-- La vecchia nota unica diceva «…e validato da un professionista osteopata di Essentia
-- Salutis, che ne assume la responsabilità clinica», e veniva stampata anche quando il
-- testo era quello di riserva della piattaforma (AI mai usata). Ora la variante la sceglie
-- ai_status (v57). La validazione professionale tornerà quando sarà registrata
-- ("validato da [nome], [data]"): allora sarà dimostrabile.
-- Entrambi i testi restano modificabili dal Listino v2.

INSERT INTO public.pricing_settings (version, key, value) VALUES
  ('v2','nota_report','Questo report è stato elaborato sui dati aggregati della vostra azienda secondo il protocollo ES Work.'),
  ('v2','nota_report_ai','Questo report è stato elaborato sui dati aggregati della vostra azienda secondo il protocollo ES Work, con il supporto di strumenti di intelligenza artificiale.')
ON CONFLICT (version, key) DO NOTHING;

DELETE FROM public.pricing_settings WHERE version = 'v2' AND key = 'nota_validazione_report';
