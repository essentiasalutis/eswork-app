-- ─────────────────────────────────────────────────────────────────────────────
-- v52 — Lessico: "assessment" → "check-up" nei testi salvati nel Listino v2.
--
-- Da applicare in Supabase (SQL editor). Idempotente: replace() su un testo già
-- corretto non cambia nulla. Tocca SOLO le frasi indicate, il resto del testo
-- (approvato da Enrico) resta com'è. "fotografia" resta (decisione Enrico: è una
-- metafora che usa lui stesso nei testi del funnel).
-- ─────────────────────────────────────────────────────────────────────────────

-- Testo di evoluzione del Pacchetto (va nel Report del cliente)
UPDATE public.pricing_settings
   SET value = replace(value, 'I dati raccolti con l''assessment', 'I dati raccolti con il check-up'),
       updated_at = now()
 WHERE version = 'v2' AND key = 'testo_evoluzione_pacchetto'
   AND value LIKE '%I dati raccolti con l''assessment%';

-- Segnaposto dell'argomentario interno (sarà sostituito dai testi di Enrico, punto 3)
UPDATE public.pricing_settings
   SET value = replace(value, 'l''assessment nel pacchetto', 'il check-up nel pacchetto'),
       updated_at = now()
 WHERE version = 'v2' AND key = 'argomentario_assessment_pacchetto'
   AND value LIKE '%l''assessment nel pacchetto%';

-- Verifica (read-only) dopo l'applicazione — 0 righe:
--   SELECT key FROM public.pricing_settings WHERE version = 'v2' AND value ILIKE '%assessment%';
