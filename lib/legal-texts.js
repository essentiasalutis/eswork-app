/**
 * Testi legali ES Work — ricavati dai file ES_Work_Informativa_Questionario.pages
 * e ES_Work_Consenso_Paziente.pages.
 *
 * ATTENZIONE: questi testi sono bozze tecniche. Prima di utilizzarli con pazienti
 * reali, devono essere revisionati e validati da un avvocato specializzato in
 * diritto sanitario e privacy. NON utilizzare senza revisione legale.
 */

// ─── PARTE 1: Informativa pre-questionario ─────────────────────────────────────

export const INFORMATIVA_QUESTIONARIO = {
  titolo: 'Informativa sul trattamento dei dati personali',
  sottotitolo: 'Resa ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (GDPR)',

  // Versione dell'informativa. Va incrementata a OGNI modifica del testo: il
  // numero accettato dall'utente viene salvato col consenso (assessment_consents.
  // informativa_version), così è sempre dimostrabile QUALE testo è stato accettato.
  version: '2026-06-13.1',

  sezioni: [
    {
      id: 'cosa_fai',
      titolo: 'Cosa stai per fare',
      testo: `Stai per compilare un questionario di prevenzione e cura dell'apparato muscolo-scheletrico.
Il questionario raccoglie informazioni riservate sugli eventuali disturbi fisici nelle varie zone del corpo, per consentire al professionista osteopata di orientare gli interventi del programma ES Work.`,
    },
    {
      id: 'dati',
      titolo: 'Quali dati raccogliamo',
      testo: `Il questionario raccoglie:
• Dati anagrafici di contatto: nome, cognome, email, telefono, sede di lavoro
• Dati sulla salute: disturbi fisici nelle zone corporee (dolore negli ultimi 12 mesi, limitazioni funzionali, dolore negli ultimi 7 giorni)

I tuoi dati sono trattati da Essentia Salutis come titolare autonomo del trattamento, nel pieno rispetto del segreto professionale. L'azienda non ha mai accesso ai tuoi dati personali né alle tue risposte individuali.`,
    },
    {
      id: 'perche',
      titolo: 'Perché raccogliamo questi dati',
      testo: `I dati vengono utilizzati per:
• Consentire al professionista osteopata di contattarti e orientare gli interventi individuali di prevenzione e cura
• Produrre un'analisi aggregata delle aree prioritarie di intervento a livello aziendale
• Monitorare i risultati nel tempo

Nessun dato individuale viene mai trasmesso al datore di lavoro. I risultati aziendali sono presentati esclusivamente in forma aggregata.`,
    },
    {
      id: 'tutele',
      titolo: 'Come tuteliamo i tuoi dati',
      testo: `I tuoi dati sono conservati su server sicuri in territorio UE (Supabase, Dublin) con crittografia in transito (HTTPS/TLS) e a riposo. L'accesso è limitato ai soli soggetti autorizzati (professionista osteopata assegnato e titolare del trattamento). Non vengono mai ceduti a terzi per finalità commerciali.`,
    },
    {
      id: 'conservazione',
      titolo: 'Per quanto tempo conserviamo i dati',
      testo: `I dati raccolti vengono conservati per almeno 10 anni dalla cessazione del programma ES Work, in conformità agli obblighi normativi in materia di documentazione sanitaria (art. 2220 c.c. e normativa di settore). Alla scadenza del termine i dati vengono cancellati a cura del titolare del trattamento. I dati aggregati e anonimizzati a livello aziendale possono essere conservati per un periodo più lungo a fini statistici.`,
    },
    {
      id: 'diritti',
      titolo: 'I tuoi diritti',
      testo: `Ai sensi del GDPR hai diritto di:
• Accedere ai tuoi dati e richiederne copia
• Rettificare dati inesatti
• Richiedere la cancellazione ("diritto all'oblio")
• Limitare il trattamento
• Opporti al trattamento
• Richiedere la portabilità dei dati
• Proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it)

Puoi esercitare questi diritti in qualsiasi momento scrivendo a info@essentiasalutis.it, senza alcun pregiudizio sulla liceità dei trattamenti effettuati in precedenza.`,
    },
  ],
};

// ─── PARTE 2a: Consenso informato al trattamento osteopatico ──────────────────

export const CONSENSO_TRATTAMENTO = {
  titolo: 'Consenso informato al trattamento osteopatico',
  riferimento: 'Legge 24/2017 (Gelli-Bianco) e normativa sull\'osteopatia come disciplina delle professioni sanitarie riabilitative',

  sezioni: [
    {
      id: 'natura',
      titolo: '1. Natura del trattamento',
      testo: `L'osteopatia è una disciplina che interviene attraverso tecniche manuali sul sistema muscolo-scheletrico, articolazioni, fasce e tessuti connettivi, con finalità somatiche e preventive. Non prevede l'uso di farmaci né di strumenti invasivi.

Nell'ambito del programma ES Work, il professionista osteopata effettuerà:
• Valutazione iniziale (anamnesi strutturata e assessment funzionale)
• Trattamenti manipolativi (tecniche strutturali, tessutali, viscerali o cranio-sacrali secondo necessità clinica)
• Monitoraggio dei risultati tramite scala NRS (Numeric Rating Scale) a ogni seduta
• Consigli posturali ed ergonomici personalizzati`,
    },
    {
      id: 'benefici',
      titolo: '2. Benefici attesi',
      testo: `Il trattamento osteopatico mira a:
• Riduzione del dolore e del disagio muscolo-scheletrico
• Miglioramento della mobilità e della funzionalità articolare
• Correzione di abitudini posturali a rischio
• Prevenzione della cronicizzazione dei disturbi`,
    },
    {
      id: 'rischi',
      titolo: '3. Rischi e possibili effetti collaterali',
      testo: `Il trattamento osteopatico è considerato sicuro e ben tollerato. Possono tuttavia verificarsi:

Effetti frequenti (normali e transitori):
• Dolore o fastidio localizzato nelle 24-48 ore successive al trattamento
• Senso di stanchezza o astenia nelle ore successive
• Lieve riacutizzazione temporanea della sintomatologia

Effetti rari:
• Sintomi più marcati che si risolvono spontaneamente entro pochi giorni

Rischi gravi (rarissimi, associati a condizioni non dichiarate):
• Controindicazioni assolute: fratture acute, patologie oncologiche in fase attiva, osteoporosi severa, aneurismi, infezioni in corso, gravidanza (per alcune tecniche)
• È essenziale comunicare al professionista qualsiasi condizione di salute rilevante prima del trattamento`,
    },
    {
      id: 'alternative',
      titolo: '4. Alternative terapeutiche',
      testo: `Il paziente è libero di non aderire al programma ES Work e di rivolgersi ad altre figure professionali o approcci terapeutici (medico di medicina generale, fisioterapista, chiropratico, ecc.) senza alcun pregiudizio.`,
    },
    {
      id: 'dichiarazione',
      titolo: '5. Dichiarazione del paziente',
      testo: `Il/La sottoscritto/a dichiara di:
• Aver letto e compreso le informazioni contenute nel presente documento
• Aver avuto la possibilità di porre domande al professionista osteopata
• Prestare il proprio consenso libero e informato all'esecuzione del trattamento osteopatico nell'ambito del programma ES Work
• Essere consapevole di poter revocare il consenso in qualsiasi momento`,
    },
  ],
};

// ─── PARTE 2b: Informativa privacy estesa (art. 13 GDPR) ─────────────────────

export const INFORMATIVA_PRIVACY_ESTESA = {
  titolo: 'Informativa sul trattamento dei dati personali',
  riferimento: 'Art. 13 del Regolamento UE 2016/679 (GDPR)',

  sezioni: [
    {
      id: 'titolare',
      titolo: '1. Titolare del trattamento',
      testo: `Essentia Salutis
Via Salbertrand 9, Torino (TO)
E-mail: info@essentiasalutis.it`,
    },
    {
      id: 'categorie',
      titolo: '2. Categorie di dati trattati',
      testo: `Nell'ambito del programma ES Work vengono trattati:
• Dati anagrafici e di contatto: nome, cognome, email, telefono, sede di lavoro, azienda di appartenenza
• Dati relativi alla salute (art. 9 GDPR): risposte al questionario muscolo-scheletrico; per i pazienti presi in carico anche anamnesi clinica, scala NRS rilevata dal professionista a ogni seduta, informazioni fisiologiche
• Dati relativi alla firma digitale e all'accettazione dei consensi`,
    },
    {
      id: 'finalita',
      titolo: '3. Finalità e base giuridica',
      testo: `I dati vengono trattati per:
a) Erogazione del programma ES Work: prestazione osteopatica, gestione della cartella paziente, monitoraggio NRS — Base giuridica: consenso esplicito (art. 6 e art. 9 GDPR)
b) Adempimento di obblighi normativi: conservazione cartella clinica (10 anni dall'ultima seduta) — Base giuridica: obbligo legale
c) Analisi statistiche aggregate e anonimizzate — Base giuridica: legittimo interesse`,
    },
    {
      id: 'conservazione',
      titolo: '4. Periodo di conservazione',
      testo: `I dati della cartella paziente (inclusi consensi, anamnesi e note di seduta) vengono conservati per almeno 10 anni dall'ultima seduta effettuata, in conformità agli obblighi normativi in materia di cartelle cliniche; alla scadenza del termine vengono cancellati a cura del titolare del trattamento.`,
    },
    {
      id: 'destinatari',
      titolo: '5. Destinatari dei dati',
      testo: `I dati personali non vengono ceduti a terzi. Possono accedere ai dati esclusivamente:
• Il professionista osteopata assegnato al programma ES Work
• Il titolare del trattamento (Essentia Salutis) per la gestione amministrativa
• Fornitori tecnici che erogano servizi di hosting (Supabase Inc., con server in UE) in qualità di responsabili del trattamento ex art. 28 GDPR`,
    },
    {
      id: 'diritti',
      titolo: '6. Diritti dell\'interessato',
      testo: `Ai sensi degli artt. 15-22 GDPR, il paziente ha diritto di:
• Accedere ai propri dati e richiederne copia
• Rettificare dati inesatti o incompleti
• Richiedere la cancellazione (entro i limiti degli obblighi di conservazione normativa)
• Limitare o opporsi al trattamento
• Richiedere la portabilità dei dati
• Proporre reclamo al Garante per la protezione dei dati personali

Per esercitare i diritti: info@essentiasalutis.it`,
    },
  ],
};
