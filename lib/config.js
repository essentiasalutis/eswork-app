export const CONFIG = {
  // ─── Stratificazione: prevalenze L1 per settore (min / medio / max) ─────────
  l1_prevalence: {
    services:      [0.07, 0.12, 0.18],   // Servizi / IT / uffici
    manufacturing: [0.10, 0.15, 0.20],   // Manifattura
    mix:           [0.08, 0.13, 0.19],   // Mix
  },
  // L2 attesi (default) = moltiplicatore × L1 atteso del settore — DA TARARE sui dati reali
  l2_multiplier_default: 2,

  // ─── Protocollo clinico (sedute) ────────────────────────────────────────────
  sessions_per_l1: 4,              // sedute trattamento per L1 (1° ciclo; il 2° è coperto dal buffer)
  prevention_sessions_per_l2: 4,   // sessioni di prevenzione attiva per L2 (solo Plus/Enterprise)
  session_duration_min: 30,        // durata seduta sportello (minuti)
  hours_per_day: 7,                // ore sportello per giornata (per stima giornate)

  // ─── Formazione ───────────────────────────────────────────────────────────
  classroom_capacity_default: 25,  // capienza aula (modificabile)
  training_modules_y1: 2,          // moduli formativi Anno 1
  training_modules_y2: 1,          // moduli formativi Anno 2+
  training_module_hours: 1,        // durata erogata per modulo (ore)

  // ─── Buffer ─────────────────────────────────────────────────────────────────
  buffer_pct: 0.20,                // 20% sul totale (copre L2→L1, self-trigger, urgenze, 2° ciclo)

  // ─── Tariffe (venduto / costo professionista) — default NUOVI clienti ───────
  rates_new: {
    sportello_sell: 120, sportello_cost: 60,        // €/ora
    prevalidation_sell: 30, prevalidation_cost: 15, // € a pre-validazione (15 min)
    training_sell: 250, training_cost: 100,         // € a modulo (1h)
  },
  // Override per clienti STORICI
  rates_legacy: {
    sportello_sell: 100, sportello_cost: 50,
    prevalidation_sell: 30, prevalidation_cost: 15,
    training_sell: 200, training_cost: 100,
  },

  // ─── Fiscale / temporale ─────────────────────────────────────────────────────
  vat_exempt: true,                // regime forfettario (esente IVA) — configurabile
  vat_pct: 0.22,
  delivery_months: 10,             // mesi di erogazione effettiva
  contract_months: 12,             // offerta annuale spalmata su 12 mesi

  // ─── Referral B2C (codici sconto dipendenti/familiari) ──────────────────────
  referral_discount_pct: 10,       // % di sconto sulle sedute private (base 10%)
  referral_session_price: 65,      // € a seduta scontata (stima fatturato B2C)

  // ─── Tier interno (uso interno; mai esposto al cliente) ─────────────────────
  tier_core_max: 150,              // Core: ~20-150
  tier_plus_max: 500,              // Plus: ~150-500 · Enterprise: >500

  // ─── ROI ──────────────────────────────────────────────────────────────────
  cost_per_absence_day: 160,

  // ─── Soglie semaforo NMQ (% Livello 1) ──────────────────────────────────────
  nmq_green_max: 20,
  nmq_yellow_max: 40,

  // ─── Servizi di piattaforma e gestione (Blocco B del PDF offerta) ────────────
  // Valori comunicati al cliente come "valore incluso nel programma" — NON sono
  // prezzi barrati né sconti. Editabili qui senza toccare il template del PDF.
  // Core: nessun valore economico mostrato (solo elenco).
  // Plus/Enterprise: valore €/anno per voce + totale + "Incluso nel programma annuale".
  management_services: {
    core: [
      { label: 'Piattaforma digitale ES Work con AI', desc: 'Piattaforma digitale proprietaria con intelligenza artificiale: assessment online, stratificazione automatica, monitoraggio in tempo reale della salute della popolazione, alert quando un dipendente peggiora, e generazione automatica della reportistica con AI.', value: 1500 },
      { label: 'Report di Attivazione + 2 Review (3 e 6 mesi) + Report Annuale', desc: 'Report alla direzione in ogni fase: attivazione, due verifiche intermedie a 3 e 6 mesi con KPI clinici aggiornati e raccomandazioni operative, e Report Annuale finale con confronto prima/dopo sui tre KPI di risultato — pronto per il bilancio di sostenibilità.', value: 2000 },
      { label: 'Coordinamento e regia ES Work', desc: 'Un unico referente che coordina l\'intero programma: gestione degli osteopati, calendario multi-sede, logistica, comunicazione con la direzione e produzione di tutta la reportistica. L\'azienda non deve coordinare nulla.', value: 2000 },
      { label: 'Documentazione OT23 INAIL', desc: 'Documentazione strutturata per la domanda di riduzione del premio assicurativo INAIL (modello OT23), inclusa nel Report Annuale. Può generare un risparmio del 5-28% sul premio.', value: 500 },
    ],
    plus: [
      { label: 'Piattaforma digitale ES Work con AI', desc: 'Piattaforma digitale proprietaria con intelligenza artificiale: assessment online, stratificazione automatica, monitoraggio in tempo reale della salute della popolazione, alert quando un dipendente peggiora, e generazione automatica della reportistica con AI.', value: 1500 },
      { label: '4 Report (Attivazione + 2 Review + Annuale)', desc: 'Report alla direzione in ogni fase: attivazione, due verifiche intermedie a 3 e 6 mesi con KPI clinici aggiornati e raccomandazioni operative, e Report Annuale finale con confronto prima/dopo sui tre KPI di risultato — pronto per il bilancio di sostenibilità.', value: 2000 },
      { label: 'Coordinamento e regia dedicato', note: 'Include 2 colloqui semestrali con la direzione e report esteso con comparazione settoriale.', desc: 'Un unico referente dedicato che coordina osteopati, calendario multi-sede, logistica e reportistica. Include due colloqui semestrali con la direzione e un report esteso con comparazione settoriale.', value: 2500 },
      { label: 'Documentazione OT23 INAIL', desc: 'Documentazione strutturata per la domanda di riduzione del premio assicurativo INAIL (modello OT23), inclusa nel Report Annuale. Può generare un risparmio del 5-28% sul premio.', value: 500 },
    ],
    enterprise: [
      { label: 'Piattaforma digitale ES Work con AI', desc: 'Piattaforma digitale proprietaria con intelligenza artificiale: assessment online, stratificazione automatica, monitoraggio in tempo reale della salute della popolazione, alert quando un dipendente peggiora, e generazione automatica della reportistica con AI.', value: 1500 },
      { label: '4 Report (Attivazione + 2 Review + Annuale)', desc: 'Report alla direzione in ogni fase: attivazione, due verifiche intermedie a 3 e 6 mesi con KPI clinici aggiornati e raccomandazioni operative, e Report Annuale finale con confronto prima/dopo sui tre KPI di risultato — pronto per il bilancio di sostenibilità.', value: 2000 },
      { label: 'Coordinamento e regia dedicato', note: 'Account dedicato, 2 colloqui semestrali con la direzione e report esteso con comparazione settoriale.', desc: 'Account dedicato che coordina l\'intero programma: osteopati, calendario multi-sede, logistica e reportistica. Include due colloqui semestrali con la direzione e un report esteso con comparazione settoriale.', value: 3000 },
      { label: 'Documentazione OT23 INAIL', desc: 'Documentazione strutturata per la domanda di riduzione del premio assicurativo INAIL (modello OT23), inclusa nel Report Annuale. Può generare un risparmio del 5-28% sul premio.', value: 500 },
      { label: 'Audit ESG e D.Lgs. 81', desc: 'Analisi di conformità e contributo agli obiettivi ESG e agli adempimenti del D.Lgs. 81 in materia di salute e sicurezza sul lavoro.', value: 2000 },
      { label: 'Roadmap triennale prevenzione', desc: 'Piano triennale di prevenzione muscolo-scheletrica con obiettivi, milestone e indicatori di risultato.', value: 1500 },
      { label: 'Presentazione al CdA', desc: 'Presentazione dei risultati e del valore del programma direttamente al Consiglio di Amministrazione.', value: 1000 },
      { label: 'Whitepaper personalizzato', desc: 'Documento personalizzato con i risultati e il caso aziendale, utilizzabile per comunicazione interna ed esterna.', value: 1000 },
    ],
  },

  // ─── Contatti (footer/offerta) ───────────────────────────────────────────────
  company_name: 'Essentia Salutis',
  company_address: 'Via Salbertrand 9, Torino',
  contact_phone: '327 102 7443',
  contact_email: 'info@essentiasalutis.it',
  contact_website: 'www.essentiasalutis.it',
};
