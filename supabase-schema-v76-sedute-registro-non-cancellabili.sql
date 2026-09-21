-- ============================================================================
-- v76 — Sedute e registro degli accessi: non si cancellano
-- ============================================================================
-- Problema trovato il 21/9: l'eliminazione di un professionista cancellava a mano
-- le sue sedute (note di trattamento, NRS) e le sue righe del registro degli
-- accessi, prima di eliminarlo. Il codice è corretto nello stesso commit
-- (si elimina solo chi non ha lasciato traccia); questa è la seconda difesa.
--
-- Decisioni di Enrico (21/9):
--   · il registro degli accessi è la prova di chi ha visto cosa: non deve essere
--     cancellabile da nessun percorso del codice, presente o futuro;
--   · una seduta è documentazione clinica: si conserva per 10 anni dal record più
--     recente (PROTOCOLLO.anni_conservazione in lib/protocollo.mjs — la banca dati
--     non può leggerlo: se cambia lì, va cambiato qui);
--   · eccezione per le aziende demo (clients.is_demo), che si devono poter rifare.
--
-- access_logs — solo in aggiunta:
--   · DELETE rifiutato, tranne le righe di pazienti di un'azienda demo;
--   · UPDATE rifiutato, tranne patient_id → NULL con tutto il resto invariato: è ciò
--     che fa la banca dati quando si cancella il paziente (ON DELETE SET NULL, v32),
--     cosa che l'app consente solo a conservazione scaduta. La riga resta.
-- sessions — non cancellabili:
--   · DELETE rifiutato, tranne aziende demo e sedute oltre i 10 anni (stessa regola
--     di lib/conservazione.mjs, così la cancellazione a termine continua a funzionare);
--   · UPDATE libero: lo storico delle sedute resta correggibile (NRS).
-- Su entrambe TRUNCATE rifiutato (anche a cascata da patients o clients).
--
-- Percorsi esistenti verificati: cancellazione di paziente e azienda (già fermate
-- dall'app entro i 10 anni), script dell'azienda demo (is_demo = true).
-- Dipende da v73 (funzione mc_e_demo). Idempotente.

-- ─── Registro degli accessi ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.access_logs_solo_aggiunta() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.patient_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.patients p WHERE p.id = OLD.patient_id AND public.mc_e_demo(p.client_id)
    ) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'access_logs: il registro degli accessi è solo in aggiunta';
  END IF;
  IF OLD.patient_id IS NOT NULL AND NEW.patient_id IS NULL
     AND (to_jsonb(NEW) - 'patient_id') = (to_jsonb(OLD) - 'patient_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'access_logs: una voce del registro non si modifica';
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS access_logs_solo_aggiunta_trg ON public.access_logs;
CREATE TRIGGER access_logs_solo_aggiunta_trg BEFORE UPDATE OR DELETE ON public.access_logs
  FOR EACH ROW EXECUTE FUNCTION public.access_logs_solo_aggiunta();

-- ─── Sedute ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sessions_non_cancellabili() RETURNS trigger AS $f$
BEGIN
  IF public.mc_e_demo(OLD.client_id) THEN RETURN OLD; END IF;
  -- 10 = PROTOCOLLO.anni_conservazione (lib/protocollo.mjs)
  IF GREATEST(OLD.closed_at, OLD.date, OLD.created_at) < now() - interval '10 years' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'sessions: una seduta è documentazione clinica e si conserva per 10 anni';
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sessions_non_cancellabili_trg ON public.sessions;
CREATE TRIGGER sessions_non_cancellabili_trg BEFORE DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sessions_non_cancellabili();

-- ─── TRUNCATE (svuota la tabella senza passare dai trigger di riga) ──────────
CREATE OR REPLACE FUNCTION public.vieta_svuotamento() RETURNS trigger AS $f$
BEGIN
  RAISE EXCEPTION '%: la tabella non si svuota', TG_TABLE_NAME;
END $f$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS access_logs_non_si_svuota_trg ON public.access_logs;
CREATE TRIGGER access_logs_non_si_svuota_trg BEFORE TRUNCATE ON public.access_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.vieta_svuotamento();
DROP TRIGGER IF EXISTS sessions_non_si_svuota_trg ON public.sessions;
CREATE TRIGGER sessions_non_si_svuota_trg BEFORE TRUNCATE ON public.sessions
  FOR EACH STATEMENT EXECUTE FUNCTION public.vieta_svuotamento();

-- ─── Verifica (facoltativa) ──────────────────────────────────────────────────
-- SELECT tgrelid::regclass, tgname FROM pg_trigger
--   WHERE tgrelid IN ('public.sessions'::regclass, 'public.access_logs'::regclass) AND NOT tgisinternal ORDER BY 1, 2;
--   → 4 righe: access_logs_non_si_svuota_trg, access_logs_solo_aggiunta_trg,
--     sessions_non_cancellabili_trg, sessions_non_si_svuota_trg
-- Prova senza effetti (una riga di login, mai cancellabile; ROLLBACK in ogni caso):
-- BEGIN;
-- DELETE FROM public.access_logs WHERE id = (SELECT id FROM public.access_logs WHERE patient_id IS NULL LIMIT 1);
-- ROLLBACK;
--   → ERRORE «access_logs: il registro degli accessi è solo in aggiunta»
--
-- Rollback:
-- DROP TRIGGER IF EXISTS access_logs_solo_aggiunta_trg ON public.access_logs;
-- DROP TRIGGER IF EXISTS access_logs_non_si_svuota_trg ON public.access_logs;
-- DROP TRIGGER IF EXISTS sessions_non_cancellabili_trg ON public.sessions;
-- DROP TRIGGER IF EXISTS sessions_non_si_svuota_trg ON public.sessions;
-- DROP FUNCTION IF EXISTS public.access_logs_solo_aggiunta(), public.sessions_non_cancellabili(), public.vieta_svuotamento();
