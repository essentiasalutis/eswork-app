-- ============================================================================
-- v67 — Via l'impostazione «Max eventi acuti/anno»
-- ============================================================================
-- Il canale degli eventi acuti è stato rimosso (17/9, commit 9ad0930): l'impostazione
-- restava modificabile in Settings senza comandare nulla. Nessuna riga del codice
-- la legge (la tabella admin_settings la leggono solo la pagina Settings e la sua API).
-- La tabella acute_events resta, come deciso.
-- Idempotente.

DELETE FROM public.admin_settings WHERE key = 'max_acute_events_per_year';

-- Verifica (attesa: 0)
-- SELECT count(*) FROM public.admin_settings WHERE key = 'max_acute_events_per_year';
