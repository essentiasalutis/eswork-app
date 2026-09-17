-- ============================================================================
-- v64 — Archivio dei testi legali e registro dei consensi
-- ============================================================================
-- Decisione di Enrico (17/9): il testo legale vive in UN SOLO posto, questo
-- archivio. Ogni versione conserva il testo integrale e la sua impronta; la
-- versione registrata su un consenso la decide il server, mai il browser.
-- Obiettivo: ricostruire fra cinque anni esattamente cosa ha letto una persona,
-- senza dipendere da git.
--
-- Garanzie scritte QUI, nella banca dati, non solo nel codice:
--   · l'impronta la calcola la banca dati (SHA-256 del testo canonico);
--   · una versione pubblicata non si modifica più: si può solo ritirare;
--   · una sola versione in vigore per documento;
--   · niente cancellazioni, né dei testi né dei consensi registrati;
--   · i consensi sono SOLO in aggiunta: la revoca è una riga nuova.
--
-- Idempotente. Da applicare PRIMA del deploy del codice che la usa.

-- ─── 1. Archivio ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.testi_legali (
  id              TEXT PRIMARY KEY,
  codice          TEXT NOT NULL,
  titolare        TEXT NOT NULL CHECK (titolare IN ('essentia_salutis', 'professionista')),
  versione        TEXT NOT NULL,
  contenuto       JSONB NOT NULL,          -- testo integrale strutturato (titolo, sezioni, consensi)
  testo_canonico  TEXT NOT NULL,           -- serializzazione fissa (lib/testi-legali.mjs)
  impronta        TEXT NOT NULL,           -- SHA-256 hex del testo canonico, calcolata dalla banca dati
  stato           TEXT NOT NULL DEFAULT 'in_vigore' CHECK (stato IN ('bozza', 'in_vigore', 'ritirata')),
  pubblicato_il   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ritirato_il     TIMESTAMPTZ,
  nota            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (codice, versione)
);

CREATE UNIQUE INDEX IF NOT EXISTS testi_legali_un_solo_in_vigore
  ON public.testi_legali (codice) WHERE stato = 'in_vigore';

-- L'impronta non la fornisce nessuno: la calcola la banca dati.
CREATE OR REPLACE FUNCTION public.testi_legali_impronta() RETURNS trigger AS $f$
BEGIN
  NEW.impronta := encode(sha256(convert_to(NEW.testo_canonico, 'UTF8')), 'hex');
  RETURN NEW;
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS testi_legali_impronta_ins ON public.testi_legali;
CREATE TRIGGER testi_legali_impronta_ins BEFORE INSERT ON public.testi_legali
  FOR EACH ROW EXECUTE FUNCTION public.testi_legali_impronta();

-- Immutabilità: pubblicata una versione, il testo non cambia più. Si può solo
-- ritirarla (una volta). Una bozza si può ancora correggere o pubblicare.
CREATE OR REPLACE FUNCTION public.testi_legali_immutabile() RETURNS trigger AS $f$
BEGIN
  IF OLD.stato = 'bozza' THEN
    NEW.impronta := encode(sha256(convert_to(NEW.testo_canonico, 'UTF8')), 'hex');
    RETURN NEW;
  END IF;
  IF NEW.codice IS DISTINCT FROM OLD.codice OR NEW.versione IS DISTINCT FROM OLD.versione
     OR NEW.titolare IS DISTINCT FROM OLD.titolare OR NEW.contenuto IS DISTINCT FROM OLD.contenuto
     OR NEW.testo_canonico IS DISTINCT FROM OLD.testo_canonico OR NEW.impronta IS DISTINCT FROM OLD.impronta
     OR NEW.pubblicato_il IS DISTINCT FROM OLD.pubblicato_il THEN
    RAISE EXCEPTION 'testi_legali: una versione pubblicata non si modifica (%, %)', OLD.codice, OLD.versione;
  END IF;
  IF OLD.stato = 'ritirata' AND NEW.stato <> 'ritirata' THEN
    RAISE EXCEPTION 'testi_legali: una versione ritirata non torna in vigore (%, %)', OLD.codice, OLD.versione;
  END IF;
  IF NEW.stato = 'ritirata' AND NEW.ritirato_il IS NULL THEN
    NEW.ritirato_il := now();
  END IF;
  RETURN NEW;
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS testi_legali_immutabile_upd ON public.testi_legali;
CREATE TRIGGER testi_legali_immutabile_upd BEFORE UPDATE ON public.testi_legali
  FOR EACH ROW EXECUTE FUNCTION public.testi_legali_immutabile();

CREATE OR REPLACE FUNCTION public.vieta_cancellazione() RETURNS trigger AS $f$
BEGIN
  RAISE EXCEPTION '%: le righe non si cancellano', TG_TABLE_NAME;
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS testi_legali_no_delete ON public.testi_legali;
CREATE TRIGGER testi_legali_no_delete BEFORE DELETE ON public.testi_legali
  FOR EACH ROW EXECUTE FUNCTION public.vieta_cancellazione();

-- ─── 2. Registro dei consensi ────────────────────────────────────────────────
-- Una riga per OGNI consenso (non una per schermata). La revoca è una riga nuova.
-- `sessione_id`: al momento delle spunte il paziente non esiste ancora (nasce alla
-- consegna del check-up). Le righe si registrano subito, legate alla sessione, e
-- alla consegna si collegano al paziente. Solo quel collegamento è ammesso.
CREATE TABLE IF NOT EXISTS public.consensi_registrati (
  id               TEXT PRIMARY KEY,
  soggetto_tipo    TEXT NOT NULL CHECK (soggetto_tipo IN ('paziente', 'professionista')),
  soggetto_id      TEXT,                   -- NULL finché la sessione non è collegata
  sessione_id      TEXT,
  consenso         TEXT NOT NULL,          -- privacy | salute | trattamento | …
  valore           TEXT NOT NULL CHECK (valore IN ('dato', 'revocato')),
  testo_legale_id  TEXT NOT NULL REFERENCES public.testi_legali(id),
  codice           TEXT NOT NULL,          -- copiati dall'archivio al momento della registrazione
  versione         TEXT NOT NULL,
  impronta         TEXT NOT NULL,
  atto_at          TIMESTAMPTZ NOT NULL DEFAULT now(),   -- orologio del SERVER
  canale           TEXT NOT NULL,          -- checkup | invito | area_personale | cartella | storico
  ip_hash          TEXT,
  user_agent       TEXT,
  nota             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (soggetto_id IS NOT NULL OR sessione_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_consensi_soggetto ON public.consensi_registrati (soggetto_tipo, soggetto_id);
CREATE INDEX IF NOT EXISTS idx_consensi_sessione ON public.consensi_registrati (sessione_id) WHERE soggetto_id IS NULL;

CREATE OR REPLACE FUNCTION public.consensi_solo_aggiunta() RETURNS trigger AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Unica eccezione: sessioni mai collegate a nessuno (check-up abbandonati),
    -- che non contengono dati personali.
    IF OLD.soggetto_id IS NULL THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'consensi_registrati: un consenso registrato non si cancella';
  END IF;
  -- UPDATE: ammesso SOLO il collegamento della sessione al soggetto, una volta.
  IF OLD.soggetto_id IS NULL AND NEW.soggetto_id IS NOT NULL
     AND NEW.consenso = OLD.consenso AND NEW.valore = OLD.valore
     AND NEW.testo_legale_id = OLD.testo_legale_id AND NEW.impronta = OLD.impronta
     AND NEW.versione = OLD.versione AND NEW.atto_at = OLD.atto_at
     AND NEW.sessione_id IS NOT DISTINCT FROM OLD.sessione_id THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'consensi_registrati: solo in aggiunta (la revoca è una riga nuova)';
END $f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consensi_solo_aggiunta_trg ON public.consensi_registrati;
CREATE TRIGGER consensi_solo_aggiunta_trg BEFORE UPDATE OR DELETE ON public.consensi_registrati
  FOR EACH ROW EXECUTE FUNCTION public.consensi_solo_aggiunta();

-- ─── 3. Documenti firmati in cartella: legati alla versione dell'archivio ─────
ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS testo_legale_id TEXT REFERENCES public.testi_legali(id),
  ADD COLUMN IF NOT EXISTS versione TEXT;

-- ─── 4. Accesso: solo dal server ─────────────────────────────────────────────
ALTER TABLE public.testi_legali ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consensi_registrati ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.testi_legali FROM anon, authenticated;
REVOKE ALL ON public.consensi_registrati FROM anon, authenticated;
GRANT ALL ON public.testi_legali TO service_role;
GRANT ALL ON public.consensi_registrati TO service_role;

-- ─── 5. Versioni iniziali: i testi in uso al 17/9 ────────────────────────────

-- informativa_checkup 2026-09-13.2 — impronta attesa 7aa13c11a968a2f48fef87628ba1eb37568bae2404ddc3f07bc90b53d0521fd1
INSERT INTO public.testi_legali (id, codice, titolare, versione, contenuto, testo_canonico, stato, nota)
VALUES ('tl_informativa_checkup_202609132', 'informativa_checkup', 'essentia_salutis', '2026-09-13.2',
  $tljson${"titolo":"Informativa sul trattamento dei dati personali","sottotitolo":"Resa ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (GDPR)","sezioni":[{"id":"cosa_fai","titolo":"Cosa stai per fare","testo":"Stai per compilare un check-up nell'ambito di ES Work, un programma di prevenzione e trattamento dei disturbi muscolo-scheletrici. Il check-up raccoglie informazioni riservate sugli eventuali disturbi fisici nelle varie zone del corpo, per consentire al professionista osteopata di orientare gli interventi del programma.\n\nLa partecipazione è volontaria. Puoi scegliere di non compilare il check-up senza alcuna conseguenza: la tua azienda non viene informata di chi ha aderito e di chi non lo ha fatto."},{"id":"titolare","titolo":"Chi tratta i tuoi dati","testo":"Titolare del trattamento: Essentia Salutis — Dott. Enrico Maiolo, Via Salbertrand 9, 10141 Torino · P.IVA 12432700016 · info@essentiasalutis.it · tel. 327 102 7443.\n\nEssentia Salutis opera come titolare autonomo del trattamento, nel rispetto del segreto professionale. La tua azienda non è titolare né responsabile del trattamento dei tuoi dati di salute e non ha mai accesso ai tuoi dati personali né alle tue risposte individuali."},{"id":"dati","titolo":"Quali dati raccogliamo","testo":"• Dati anagrafici e di contatto: nome, cognome, email, telefono, sede di lavoro.\n• Dati relativi alla salute: disturbi fisici nelle zone corporee (dolore negli ultimi 12 mesi, limitazioni funzionali, dolore negli ultimi 7 giorni)."},{"id":"perche","titolo":"Perché raccogliamo questi dati","testo":"I dati vengono utilizzati per:\n• consentire al professionista osteopata di contattarti e orientare gli interventi individuali di prevenzione e trattamento;\n• produrre un'analisi aggregata delle aree prioritarie di intervento a livello aziendale;\n• monitorare i risultati del programma nel tempo.\n\nNessun dato individuale viene mai trasmesso al datore di lavoro. I risultati aziendali sono presentati esclusivamente in forma aggregata, con soglie che impediscono l'identificazione delle singole persone."},{"id":"base_giuridica","titolo":"Su quale base giuridica","testo":"Il trattamento dei dati relativi alla salute si fonda sul tuo consenso esplicito (art. 9, par. 2, lett. a del GDPR), in combinato con la finalità di medicina preventiva e assistenza sanitaria (art. 9, par. 2, lett. h). Il trattamento dei dati anagrafici e di contatto si fonda sul consenso e sull'esecuzione del programma cui aderisci (art. 6, par. 1, lett. a e b)."},{"id":"elaborazione","titolo":"Come vengono elaborate le tue risposte","testo":"Le risposte al check-up sono elaborate con un algoritmo di classificazione che individua il livello di intervento più adatto alla tua situazione (trattamento individuale, prevenzione o formazione). La valutazione è sempre verificata da un professionista sanitario e non produce effetti giuridici né incide in alcun modo sul tuo rapporto di lavoro. Puoi chiedere in qualsiasi momento chiarimenti sulla classificazione attribuita."},{"id":"accesso","titolo":"Chi può accedere ai tuoi dati","testo":"• Il professionista osteopata che ti prende in carico, tenuto al segreto professionale.\n• Il titolare del trattamento, per le finalità di gestione e monitoraggio del programma.\n• I fornitori tecnici che operano come responsabili del trattamento ai sensi dell'art. 28 GDPR: il fornitore del servizio di archiviazione dati (server in Unione Europea), il fornitore di hosting dell'applicazione e il fornitore del servizio di elaborazione testi per la reportistica.\n\nVerso i fornitori con sede al di fuori dell'Unione Europea vengono trasmessi esclusivamente dati statistici aggregati, privi di dati identificativi e di contenuti clinici riferibili a singole persone. Tali trasferimenti sono regolati da Clausole Contrattuali Standard approvate dalla Commissione Europea. I tuoi dati non vengono mai ceduti a terzi per finalità commerciali né utilizzati per addestrare sistemi di intelligenza artificiale."},{"id":"tutele","titolo":"Come tuteliamo i tuoi dati","testo":"I dati sono conservati su server situati nell'Unione Europea, con cifratura in transito e a riposo. L'accesso è nominale, limitato ai soli soggetti autorizzati e registrato. La tua area personale è protetta da un collegamento riservato: non condividerlo con altre persone."},{"id":"conservazione","titolo":"Per quanto tempo conserviamo i dati","testo":"I dati clinici sono conservati per 10 anni dalla conclusione del programma, in conformità agli obblighi di conservazione della documentazione sanitaria. I dati di contatto sono conservati per la durata del programma e cancellati entro 24 mesi dalla sua conclusione. I dati aggregati e privi di riferimenti identificativi possono essere conservati per periodi più lunghi a fini statistici.\n\nSe il programma non viene attivato dall'azienda, i tuoi dati di contatto sono cancellati entro 6 mesi dalla chiusura del check-up; i dati aggregati e privi di riferimenti identificativi possono essere conservati a fini statistici."},{"id":"diritti","titolo":"I tuoi diritti","testo":"Ai sensi del GDPR hai diritto di:\n• accedere ai tuoi dati e richiederne copia;\n• rettificare dati inesatti;\n• richiedere la cancellazione (\"diritto all'oblio\");\n• limitare il trattamento;\n• opporti al trattamento;\n• richiedere la portabilità dei dati;\n• proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).\n\nRevoca del consenso. Puoi revocare il consenso in qualsiasi momento, con la stessa facilità con cui lo hai prestato, scrivendo a info@essentiasalutis.it. La revoca interrompe il trattamento per il futuro e non pregiudica la liceità dei trattamenti effettuati in precedenza. Restano fermi gli obblighi di conservazione della documentazione sanitaria previsti dalla legge."}],"consensi":{"privacy":"Dichiaro di aver letto l'informativa e presto il consenso al trattamento dei miei dati personali.","salute":"Presto il consenso al trattamento dei dati relativi alla salute (art. 9 GDPR) per le finalità di prevenzione e trattamento del programma ES Work."}}$tljson$::jsonb,
  $tltxt$# Informativa sul trattamento dei dati personali
Resa ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (GDPR)

## Cosa stai per fare
Stai per compilare un check-up nell'ambito di ES Work, un programma di prevenzione e trattamento dei disturbi muscolo-scheletrici. Il check-up raccoglie informazioni riservate sugli eventuali disturbi fisici nelle varie zone del corpo, per consentire al professionista osteopata di orientare gli interventi del programma.

La partecipazione è volontaria. Puoi scegliere di non compilare il check-up senza alcuna conseguenza: la tua azienda non viene informata di chi ha aderito e di chi non lo ha fatto.

## Chi tratta i tuoi dati
Titolare del trattamento: Essentia Salutis — Dott. Enrico Maiolo, Via Salbertrand 9, 10141 Torino · P.IVA 12432700016 · info@essentiasalutis.it · tel. 327 102 7443.

Essentia Salutis opera come titolare autonomo del trattamento, nel rispetto del segreto professionale. La tua azienda non è titolare né responsabile del trattamento dei tuoi dati di salute e non ha mai accesso ai tuoi dati personali né alle tue risposte individuali.

## Quali dati raccogliamo
• Dati anagrafici e di contatto: nome, cognome, email, telefono, sede di lavoro.
• Dati relativi alla salute: disturbi fisici nelle zone corporee (dolore negli ultimi 12 mesi, limitazioni funzionali, dolore negli ultimi 7 giorni).

## Perché raccogliamo questi dati
I dati vengono utilizzati per:
• consentire al professionista osteopata di contattarti e orientare gli interventi individuali di prevenzione e trattamento;
• produrre un'analisi aggregata delle aree prioritarie di intervento a livello aziendale;
• monitorare i risultati del programma nel tempo.

Nessun dato individuale viene mai trasmesso al datore di lavoro. I risultati aziendali sono presentati esclusivamente in forma aggregata, con soglie che impediscono l'identificazione delle singole persone.

## Su quale base giuridica
Il trattamento dei dati relativi alla salute si fonda sul tuo consenso esplicito (art. 9, par. 2, lett. a del GDPR), in combinato con la finalità di medicina preventiva e assistenza sanitaria (art. 9, par. 2, lett. h). Il trattamento dei dati anagrafici e di contatto si fonda sul consenso e sull'esecuzione del programma cui aderisci (art. 6, par. 1, lett. a e b).

## Come vengono elaborate le tue risposte
Le risposte al check-up sono elaborate con un algoritmo di classificazione che individua il livello di intervento più adatto alla tua situazione (trattamento individuale, prevenzione o formazione). La valutazione è sempre verificata da un professionista sanitario e non produce effetti giuridici né incide in alcun modo sul tuo rapporto di lavoro. Puoi chiedere in qualsiasi momento chiarimenti sulla classificazione attribuita.

## Chi può accedere ai tuoi dati
• Il professionista osteopata che ti prende in carico, tenuto al segreto professionale.
• Il titolare del trattamento, per le finalità di gestione e monitoraggio del programma.
• I fornitori tecnici che operano come responsabili del trattamento ai sensi dell'art. 28 GDPR: il fornitore del servizio di archiviazione dati (server in Unione Europea), il fornitore di hosting dell'applicazione e il fornitore del servizio di elaborazione testi per la reportistica.

Verso i fornitori con sede al di fuori dell'Unione Europea vengono trasmessi esclusivamente dati statistici aggregati, privi di dati identificativi e di contenuti clinici riferibili a singole persone. Tali trasferimenti sono regolati da Clausole Contrattuali Standard approvate dalla Commissione Europea. I tuoi dati non vengono mai ceduti a terzi per finalità commerciali né utilizzati per addestrare sistemi di intelligenza artificiale.

## Come tuteliamo i tuoi dati
I dati sono conservati su server situati nell'Unione Europea, con cifratura in transito e a riposo. L'accesso è nominale, limitato ai soli soggetti autorizzati e registrato. La tua area personale è protetta da un collegamento riservato: non condividerlo con altre persone.

## Per quanto tempo conserviamo i dati
I dati clinici sono conservati per 10 anni dalla conclusione del programma, in conformità agli obblighi di conservazione della documentazione sanitaria. I dati di contatto sono conservati per la durata del programma e cancellati entro 24 mesi dalla sua conclusione. I dati aggregati e privi di riferimenti identificativi possono essere conservati per periodi più lunghi a fini statistici.

Se il programma non viene attivato dall'azienda, i tuoi dati di contatto sono cancellati entro 6 mesi dalla chiusura del check-up; i dati aggregati e privi di riferimenti identificativi possono essere conservati a fini statistici.

## I tuoi diritti
Ai sensi del GDPR hai diritto di:
• accedere ai tuoi dati e richiederne copia;
• rettificare dati inesatti;
• richiedere la cancellazione ("diritto all'oblio");
• limitare il trattamento;
• opporti al trattamento;
• richiedere la portabilità dei dati;
• proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).

Revoca del consenso. Puoi revocare il consenso in qualsiasi momento, con la stessa facilità con cui lo hai prestato, scrivendo a info@essentiasalutis.it. La revoca interrompe il trattamento per il futuro e non pregiudica la liceità dei trattamenti effettuati in precedenza. Restano fermi gli obblighi di conservazione della documentazione sanitaria previsti dalla legge.

## Consensi
[privacy] Dichiaro di aver letto l'informativa e presto il consenso al trattamento dei miei dati personali.
[salute] Presto il consenso al trattamento dei dati relativi alla salute (art. 9 GDPR) per le finalità di prevenzione e trattamento del programma ES Work.$tltxt$,
  'in_vigore',
  $tlnota$Versione ricostruita dalla storia del codice (lib/legal-texts.js, commit 6fbdf58 del 13/9/2026, invariata fino al 17/9) e archiviata il 17/9/2026: non registrata al momento dei consensi raccolti fino a quella data.$tlnota$)
ON CONFLICT (codice, versione) DO NOTHING;

-- consenso_trattamento 2026-09-17.1 — impronta attesa 95405a0d1c7fd6f53c5e66744bf8061f1ded48900b70dc393ff3e9f258b140bf
INSERT INTO public.testi_legali (id, codice, titolare, versione, contenuto, testo_canonico, stato, nota)
VALUES ('tl_consenso_trattamento_202609171', 'consenso_trattamento', 'professionista', '2026-09-17.1',
  $tljson${"titolo":"Consenso informato al trattamento osteopatico","riferimento":"Legge 24/2017 (Gelli-Bianco) e normativa sull'osteopatia come disciplina delle professioni sanitarie riabilitative","sezioni":[{"id":"natura","titolo":"1. Natura del trattamento","testo":"L'osteopatia è una disciplina che interviene attraverso tecniche manuali sul sistema muscolo-scheletrico, articolazioni, fasce e tessuti connettivi, con finalità somatiche e preventive. Non prevede l'uso di farmaci né di strumenti invasivi.\n\nNell'ambito del programma ES Work, il professionista osteopata effettuerà:\n• Valutazione iniziale (anamnesi strutturata e assessment funzionale)\n• Trattamenti manipolativi (tecniche strutturali, tessutali, viscerali o cranio-sacrali secondo necessità clinica)\n• Monitoraggio dei risultati tramite scala NRS (Numeric Rating Scale) a ogni seduta\n• Consigli posturali ed ergonomici personalizzati"},{"id":"benefici","titolo":"2. Benefici attesi","testo":"Il trattamento osteopatico mira a:\n• Riduzione del dolore e del disagio muscolo-scheletrico\n• Miglioramento della mobilità e della funzionalità articolare\n• Correzione di abitudini posturali a rischio\n• Prevenzione della cronicizzazione dei disturbi"},{"id":"rischi","titolo":"3. Rischi e possibili effetti collaterali","testo":"Il trattamento osteopatico è considerato sicuro e ben tollerato. Possono tuttavia verificarsi:\n\nEffetti frequenti (normali e transitori):\n• Dolore o fastidio localizzato nelle 24-48 ore successive al trattamento\n• Senso di stanchezza o astenia nelle ore successive\n• Lieve riacutizzazione temporanea della sintomatologia\n\nEffetti rari:\n• Sintomi più marcati che si risolvono spontaneamente entro pochi giorni\n\nRischi gravi (rarissimi, associati a condizioni non dichiarate):\n• Controindicazioni assolute: fratture acute, patologie oncologiche in fase attiva, osteoporosi severa, aneurismi, infezioni in corso, gravidanza (per alcune tecniche)\n• È essenziale comunicare al professionista qualsiasi condizione di salute rilevante prima del trattamento"},{"id":"alternative","titolo":"4. Alternative terapeutiche","testo":"Il paziente è libero di non aderire al programma ES Work e di rivolgersi ad altre figure professionali o approcci terapeutici (medico di medicina generale, fisioterapista, chiropratico, ecc.) senza alcun pregiudizio."},{"id":"dichiarazione","titolo":"5. Dichiarazione del paziente","testo":"Il/La sottoscritto/a dichiara di:\n• Aver letto e compreso le informazioni contenute nel presente documento\n• Aver avuto la possibilità di porre domande al professionista osteopata\n• Prestare il proprio consenso libero e informato all'esecuzione del trattamento osteopatico nell'ambito del programma ES Work\n• Essere consapevole di poter revocare il consenso in qualsiasi momento"}]}$tljson$::jsonb,
  $tltxt$# Consenso informato al trattamento osteopatico
Legge 24/2017 (Gelli-Bianco) e normativa sull'osteopatia come disciplina delle professioni sanitarie riabilitative

## 1. Natura del trattamento
L'osteopatia è una disciplina che interviene attraverso tecniche manuali sul sistema muscolo-scheletrico, articolazioni, fasce e tessuti connettivi, con finalità somatiche e preventive. Non prevede l'uso di farmaci né di strumenti invasivi.

Nell'ambito del programma ES Work, il professionista osteopata effettuerà:
• Valutazione iniziale (anamnesi strutturata e assessment funzionale)
• Trattamenti manipolativi (tecniche strutturali, tessutali, viscerali o cranio-sacrali secondo necessità clinica)
• Monitoraggio dei risultati tramite scala NRS (Numeric Rating Scale) a ogni seduta
• Consigli posturali ed ergonomici personalizzati

## 2. Benefici attesi
Il trattamento osteopatico mira a:
• Riduzione del dolore e del disagio muscolo-scheletrico
• Miglioramento della mobilità e della funzionalità articolare
• Correzione di abitudini posturali a rischio
• Prevenzione della cronicizzazione dei disturbi

## 3. Rischi e possibili effetti collaterali
Il trattamento osteopatico è considerato sicuro e ben tollerato. Possono tuttavia verificarsi:

Effetti frequenti (normali e transitori):
• Dolore o fastidio localizzato nelle 24-48 ore successive al trattamento
• Senso di stanchezza o astenia nelle ore successive
• Lieve riacutizzazione temporanea della sintomatologia

Effetti rari:
• Sintomi più marcati che si risolvono spontaneamente entro pochi giorni

Rischi gravi (rarissimi, associati a condizioni non dichiarate):
• Controindicazioni assolute: fratture acute, patologie oncologiche in fase attiva, osteoporosi severa, aneurismi, infezioni in corso, gravidanza (per alcune tecniche)
• È essenziale comunicare al professionista qualsiasi condizione di salute rilevante prima del trattamento

## 4. Alternative terapeutiche
Il paziente è libero di non aderire al programma ES Work e di rivolgersi ad altre figure professionali o approcci terapeutici (medico di medicina generale, fisioterapista, chiropratico, ecc.) senza alcun pregiudizio.

## 5. Dichiarazione del paziente
Il/La sottoscritto/a dichiara di:
• Aver letto e compreso le informazioni contenute nel presente documento
• Aver avuto la possibilità di porre domande al professionista osteopata
• Prestare il proprio consenso libero e informato all'esecuzione del trattamento osteopatico nell'ambito del programma ES Work
• Essere consapevole di poter revocare il consenso in qualsiasi momento$tltxt$,
  'in_vigore',
  $tlnota$Prima versione archiviata (17/9/2026): testo in uso in piattaforma a quella data. Nessuna firma raccolta prima dell'archiviazione.$tlnota$)
ON CONFLICT (codice, versione) DO NOTHING;

-- informativa_estesa 2026-09-17.1 — impronta attesa 04a954958e1270fd544e5beeb55efa074f5f70204e9fe7bef52118226a0d97aa
INSERT INTO public.testi_legali (id, codice, titolare, versione, contenuto, testo_canonico, stato, nota)
VALUES ('tl_informativa_estesa_202609171', 'informativa_estesa', 'professionista', '2026-09-17.1',
  $tljson${"titolo":"Informativa sul trattamento dei dati personali","riferimento":"Art. 13 del Regolamento UE 2016/679 (GDPR)","sezioni":[{"id":"titolare","titolo":"1. Titolare del trattamento","testo":"Essentia Salutis\nVia Salbertrand 9, Torino (TO)\nE-mail: info@essentiasalutis.it"},{"id":"categorie","titolo":"2. Categorie di dati trattati","testo":"Nell'ambito del programma ES Work vengono trattati:\n• Dati anagrafici e di contatto: nome, cognome, email, telefono, sede di lavoro, azienda di appartenenza\n• Dati relativi alla salute (art. 9 GDPR): risposte al questionario muscolo-scheletrico; per i pazienti presi in carico anche anamnesi clinica, scala NRS rilevata dal professionista a ogni seduta, informazioni fisiologiche\n• Dati relativi alla firma digitale e all'accettazione dei consensi"},{"id":"finalita","titolo":"3. Finalità e base giuridica","testo":"I dati vengono trattati per:\na) Erogazione del programma ES Work: prestazione osteopatica, gestione della cartella paziente, monitoraggio NRS — Base giuridica: consenso esplicito (art. 6 e art. 9 GDPR)\nb) Adempimento di obblighi normativi: conservazione cartella clinica (10 anni dall'ultima seduta) — Base giuridica: obbligo legale\nc) Analisi statistiche aggregate e anonimizzate — Base giuridica: legittimo interesse"},{"id":"conservazione","titolo":"4. Periodo di conservazione","testo":"I dati della cartella paziente (inclusi consensi, anamnesi e note di seduta) vengono conservati per almeno 10 anni dall'ultima seduta effettuata, in conformità agli obblighi normativi in materia di cartelle cliniche; alla scadenza del termine vengono cancellati a cura del titolare del trattamento."},{"id":"destinatari","titolo":"5. Destinatari dei dati","testo":"I dati personali non vengono ceduti a terzi. Possono accedere ai dati esclusivamente:\n• Il professionista osteopata assegnato al programma ES Work\n• Il titolare del trattamento (Essentia Salutis) per la gestione amministrativa\n• Fornitori tecnici che erogano servizi di hosting (Supabase Inc., con server in UE) in qualità di responsabili del trattamento ex art. 28 GDPR"},{"id":"diritti","titolo":"6. Diritti dell'interessato","testo":"Ai sensi degli artt. 15-22 GDPR, il paziente ha diritto di:\n• Accedere ai propri dati e richiederne copia\n• Rettificare dati inesatti o incompleti\n• Richiedere la cancellazione (entro i limiti degli obblighi di conservazione normativa)\n• Limitare o opporsi al trattamento\n• Richiedere la portabilità dei dati\n• Proporre reclamo al Garante per la protezione dei dati personali\n\nPer esercitare i diritti: info@essentiasalutis.it"}]}$tljson$::jsonb,
  $tltxt$# Informativa sul trattamento dei dati personali
Art. 13 del Regolamento UE 2016/679 (GDPR)

## 1. Titolare del trattamento
Essentia Salutis
Via Salbertrand 9, Torino (TO)
E-mail: info@essentiasalutis.it

## 2. Categorie di dati trattati
Nell'ambito del programma ES Work vengono trattati:
• Dati anagrafici e di contatto: nome, cognome, email, telefono, sede di lavoro, azienda di appartenenza
• Dati relativi alla salute (art. 9 GDPR): risposte al questionario muscolo-scheletrico; per i pazienti presi in carico anche anamnesi clinica, scala NRS rilevata dal professionista a ogni seduta, informazioni fisiologiche
• Dati relativi alla firma digitale e all'accettazione dei consensi

## 3. Finalità e base giuridica
I dati vengono trattati per:
a) Erogazione del programma ES Work: prestazione osteopatica, gestione della cartella paziente, monitoraggio NRS — Base giuridica: consenso esplicito (art. 6 e art. 9 GDPR)
b) Adempimento di obblighi normativi: conservazione cartella clinica (10 anni dall'ultima seduta) — Base giuridica: obbligo legale
c) Analisi statistiche aggregate e anonimizzate — Base giuridica: legittimo interesse

## 4. Periodo di conservazione
I dati della cartella paziente (inclusi consensi, anamnesi e note di seduta) vengono conservati per almeno 10 anni dall'ultima seduta effettuata, in conformità agli obblighi normativi in materia di cartelle cliniche; alla scadenza del termine vengono cancellati a cura del titolare del trattamento.

## 5. Destinatari dei dati
I dati personali non vengono ceduti a terzi. Possono accedere ai dati esclusivamente:
• Il professionista osteopata assegnato al programma ES Work
• Il titolare del trattamento (Essentia Salutis) per la gestione amministrativa
• Fornitori tecnici che erogano servizi di hosting (Supabase Inc., con server in UE) in qualità di responsabili del trattamento ex art. 28 GDPR

## 6. Diritti dell'interessato
Ai sensi degli artt. 15-22 GDPR, il paziente ha diritto di:
• Accedere ai propri dati e richiederne copia
• Rettificare dati inesatti o incompleti
• Richiedere la cancellazione (entro i limiti degli obblighi di conservazione normativa)
• Limitare o opporsi al trattamento
• Richiedere la portabilità dei dati
• Proporre reclamo al Garante per la protezione dei dati personali

Per esercitare i diritti: info@essentiasalutis.it$tltxt$,
  'in_vigore',
  $tlnota$Prima versione archiviata (17/9/2026): testo in uso in piattaforma a quella data. Nessuna firma raccolta prima dell'archiviazione.$tlnota$)
ON CONFLICT (codice, versione) DO NOTHING;

-- ─── 6. Pregresso: i consensi già raccolti, riportati con una nota onesta ─────
-- Una riga per ciascuno dei due consensi di ogni registrazione esistente. Le date
-- sono quelle salvate allora (identiche fra loro: era il difetto corretto qui).
INSERT INTO public.consensi_registrati
  (id, soggetto_tipo, soggetto_id, consenso, valore, testo_legale_id, codice, versione, impronta,
   atto_at, canale, ip_hash, user_agent, nota)
SELECT 'cr_storico_' || ac.id || '_' || k.consenso, 'paziente', ac.patient_id, k.consenso, 'dato',
       tl.id, tl.codice, tl.versione, tl.impronta,
       CASE k.consenso WHEN 'privacy' THEN ac.consent_privacy_at ELSE ac.consent_health_at END,
       'storico', ac.ip_hash, ac.user_agent,
       'Riportato il 17/9/2026 da assessment_consents. Versione ricostruita dalla storia del codice, non registrata al momento del consenso; i due consensi furono registrati nello stesso istante e con valori non verificati dal server.'
FROM public.assessment_consents ac
JOIN public.testi_legali tl ON tl.codice = 'informativa_checkup' AND tl.versione = ac.informativa_version
CROSS JOIN (VALUES ('privacy'), ('salute')) AS k(consenso)
WHERE ac.patient_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Verifica (facoltativa):
-- SELECT codice, versione, stato, impronta FROM public.testi_legali ORDER BY codice;
-- SELECT canale, count(*) FROM public.consensi_registrati GROUP BY canale;
