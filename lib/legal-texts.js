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
  // 2026-09-13.1 — riscrittura integrale (testo di Enrico): titolare e contatti,
  // base giuridica, come vengono elaborate le risposte, chi accede ai dati,
  // trasferimenti extra-UE (solo aggregati), conservazione, revoca del consenso.
  version: '2026-09-13.1',

  sezioni: [
    {
      id: 'cosa_fai',
      titolo: 'Cosa stai per fare',
      testo: `Stai per compilare un check-up nell'ambito di ES Work, un programma di prevenzione e trattamento dei disturbi muscolo-scheletrici. Il check-up raccoglie informazioni riservate sugli eventuali disturbi fisici nelle varie zone del corpo, per consentire al professionista osteopata di orientare gli interventi del programma.

La partecipazione è volontaria. Puoi scegliere di non compilare il check-up senza alcuna conseguenza: la tua azienda non viene informata di chi ha aderito e di chi non lo ha fatto.`,
    },
    {
      id: 'titolare',
      titolo: 'Chi tratta i tuoi dati',
      testo: `Titolare del trattamento: Essentia Salutis — Dott. Enrico Maiolo, Via Salbertrand 9, 10141 Torino · P.IVA 12432700016 · info@essentiasalutis.it · tel. 327 102 7443.

Essentia Salutis opera come titolare autonomo del trattamento, nel rispetto del segreto professionale. La tua azienda non è titolare né responsabile del trattamento dei tuoi dati di salute e non ha mai accesso ai tuoi dati personali né alle tue risposte individuali.`,
    },
    {
      id: 'dati',
      titolo: 'Quali dati raccogliamo',
      testo: `• Dati anagrafici e di contatto: nome, cognome, email, telefono, sede di lavoro.
• Dati relativi alla salute: disturbi fisici nelle zone corporee (dolore negli ultimi 12 mesi, limitazioni funzionali, dolore negli ultimi 7 giorni).`,
    },
    {
      id: 'perche',
      titolo: 'Perché raccogliamo questi dati',
      testo: `I dati vengono utilizzati per:
• consentire al professionista osteopata di contattarti e orientare gli interventi individuali di prevenzione e trattamento;
• produrre un'analisi aggregata delle aree prioritarie di intervento a livello aziendale;
• monitorare i risultati del programma nel tempo.

Nessun dato individuale viene mai trasmesso al datore di lavoro. I risultati aziendali sono presentati esclusivamente in forma aggregata, con soglie che impediscono l'identificazione delle singole persone.`,
    },
    {
      id: 'base_giuridica',
      titolo: 'Su quale base giuridica',
      testo: `Il trattamento dei dati relativi alla salute si fonda sul tuo consenso esplicito (art. 9, par. 2, lett. a del GDPR), in combinato con la finalità di medicina preventiva e assistenza sanitaria (art. 9, par. 2, lett. h). Il trattamento dei dati anagrafici e di contatto si fonda sul consenso e sull'esecuzione del programma cui aderisci (art. 6, par. 1, lett. a e b).`,
    },
    {
      id: 'elaborazione',
      titolo: 'Come vengono elaborate le tue risposte',
      testo: `Le risposte al check-up sono elaborate con un algoritmo di classificazione che individua il livello di intervento più adatto alla tua situazione (trattamento individuale, prevenzione o formazione). La valutazione è sempre verificata da un professionista sanitario e non produce effetti giuridici né incide in alcun modo sul tuo rapporto di lavoro. Puoi chiedere in qualsiasi momento chiarimenti sulla classificazione attribuita.`,
    },
    {
      id: 'accesso',
      titolo: 'Chi può accedere ai tuoi dati',
      testo: `• Il professionista osteopata che ti prende in carico, tenuto al segreto professionale.
• Il titolare del trattamento, per le finalità di gestione e monitoraggio del programma.
• I fornitori tecnici che operano come responsabili del trattamento ai sensi dell'art. 28 GDPR: il fornitore del servizio di archiviazione dati (server in Unione Europea), il fornitore di hosting dell'applicazione e il fornitore del servizio di elaborazione testi per la reportistica.

Verso i fornitori con sede al di fuori dell'Unione Europea vengono trasmessi esclusivamente dati statistici aggregati, privi di dati identificativi e di contenuti clinici riferibili a singole persone. Tali trasferimenti sono regolati da Clausole Contrattuali Standard approvate dalla Commissione Europea. I tuoi dati non vengono mai ceduti a terzi per finalità commerciali né utilizzati per addestrare sistemi di intelligenza artificiale.`,
    },
    {
      id: 'tutele',
      titolo: 'Come tuteliamo i tuoi dati',
      testo: `I dati sono conservati su server situati nell'Unione Europea, con cifratura in transito e a riposo. L'accesso è nominale, limitato ai soli soggetti autorizzati e registrato. La tua area personale è protetta da un collegamento riservato: non condividerlo con altre persone.`,
    },
    {
      id: 'conservazione',
      titolo: 'Per quanto tempo conserviamo i dati',
      testo: `I dati clinici sono conservati per 10 anni dalla conclusione del programma, in conformità agli obblighi di conservazione della documentazione sanitaria. I dati di contatto sono conservati per la durata del programma e cancellati entro 24 mesi dalla sua conclusione. I dati aggregati e privi di riferimenti identificativi possono essere conservati per periodi più lunghi a fini statistici.`,
    },
    {
      id: 'diritti',
      titolo: 'I tuoi diritti',
      testo: `Ai sensi del GDPR hai diritto di:
• accedere ai tuoi dati e richiederne copia;
• rettificare dati inesatti;
• richiedere la cancellazione ("diritto all'oblio");
• limitare il trattamento;
• opporti al trattamento;
• richiedere la portabilità dei dati;
• proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).

Revoca del consenso. Puoi revocare il consenso in qualsiasi momento, con la stessa facilità con cui lo hai prestato, scrivendo a info@essentiasalutis.it. La revoca interrompe il trattamento per il futuro e non pregiudica la liceità dei trattamenti effettuati in precedenza. Restano fermi gli obblighi di conservazione della documentazione sanitaria previsti dalla legge.`,
    },
  ],

  // Le due caselle: entrambe obbligatorie per proseguire.
  consensi: {
    privacy: 'Dichiaro di aver letto l\'informativa e presto il consenso al trattamento dei miei dati personali.',
    salute: 'Presto il consenso al trattamento dei dati relativi alla salute (art. 9 GDPR) per le finalità di prevenzione e trattamento del programma ES Work.',
  },
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
