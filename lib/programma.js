// ─────────────────────────────────────────────────────────────────────────────
// "Cosa comprende il programma" — FONTE UNICA delle 12 voci del programma completo
// (Stima, Report di Attivazione, Offerta; poi la mail di riepilogo). Modulo PURO.
// Testi di Enrico (settembre 2026), VERBATIM. Uniche modifiche decise da lui:
//   - voce 1 e 9: "rilevazione" → "check-up" (per le persone, non un dato);
//   - voce 11: vale il nome in piattaforma, "Piattaforma digitale ES Work".
// `cliente` = testo per il cliente [C]; `argomentario` = solo interno [A], mai stampato.
// I valori dichiarati NON stanno qui: sono le 4 righe di servizi_deliverable (Listino).
// ─────────────────────────────────────────────────────────────────────────────

export const VOCI_PROGRAMMA = [
  {
    n: 1,
    nome: 'Check-up muscolo-scheletrico iniziale',
    cliente: `Check-up digitale su tutta la popolazione aziendale con questionario NMQ, standard validato a livello internazionale. Riservato: meno di 5 minuti da smartphone, l'azienda riceve solo dati aggregati. È la fotografia da cui parte tutto il programma.`,
    argomentario: `È il punto in cui il problema smette di essere un'opinione e diventa un numero. Prima del contratto è a nostro carico: serve a dimensionare il programma sui dati reali, non su una stima. Se chiedono perché un questionario e non una visita: la visita a 200 persone non si fa, il questionario sì, e permette di capire chi ha davvero bisogno.`,
  },
  {
    n: 2,
    nome: 'Report di Attivazione',
    cliente: `Il documento che apre il programma: fotografia della popolazione, stratificazione sui tre livelli di intervento, piano di intervento dimensionato e preventivo calcolato sui dati reali. Presentato di persona.`,
    argomentario: `È il deliverable che giustifica tutto il resto. Contiene il cruscotto a semafori e le mappe corporee: è ciò che il titolare mostra al proprio consiglio o al proprio commercialista. Diventa Allegato A del contratto: il prezzo non è più trattabile a voce, è documentato.`,
  },
  {
    n: 3,
    nome: 'Sportello osteopatico in sede',
    cliente: `Giornate di sportello in azienda secondo calendario concordato, in uno spazio riservato messo a disposizione dall'azienda. Sessioni individuali da 30 minuti con professionisti sanitari del network.`,
    argomentario: `È la parte che i dipendenti percepiscono come valore immediato: niente spostamenti, niente liste d'attesa, durante l'orario di lavoro. È anche la voce che rende concreto tutto il resto: senza qualcuno che mette le mani, resta un corso.`,
  },
  {
    n: 4,
    nome: 'Cicli clinici (Livello 1)',
    cliente: `Per chi presenta dolore con impatto funzionale: ciclo di 4 sedute con rilevazione del dolore prima e dopo ogni seduta, fino a due cicli l'anno per persona, con un intervallo minimo tra i cicli.`,
    argomentario: `Quattro sedute non sono un compromesso al ribasso: sono il formato che permette di misurare un cambiamento e di documentarlo. Se chiedono "e se non basta": c'è il secondo ciclo, e comunque il programma non promette guarigioni — promette presa in carico e misura.`,
  },
  {
    n: 5,
    nome: 'Prevenzione individuale (Livello 2)',
    cliente: `Per chi presenta segnali senza impatto funzionale: 4 sessioni di prevenzione l'anno per persona, dal primo anno di programma.`,
    argomentario: `È la voce che distingue ES Work da un servizio di trattamento: intercetta le persone prima che diventino casi clinici. È anche la ragione per cui il programma lavora anche in un'azienda "sana" — dove non c'è ancora dolore, c'è prevenzione da fare.`,
  },
  {
    n: 6,
    nome: 'Formazione su postura ed ergonomia',
    cliente: `Sessioni collettive aperte a tutti i dipendenti, non solo a chi ha sintomi: due temi l'anno, teoria e pratica sul gesto, in gruppi dimensionati sulla popolazione. Chi entra in azienda durante l'anno recupera la formazione con sessioni dedicate.`,
    argomentario: `È l'unica voce che tocca il 100% delle persone, ed è quella che costruisce la cultura: senza, il trattamento è una riparazione che si ripete. Per l'azienda è anche l'elemento più visibile — tutti partecipano, tutti vedono che è stato fatto qualcosa.`,
  },
  {
    n: 7,
    nome: 'Consulenza ergonomico-posturale',
    cliente: `Osservazione delle postazioni di lavoro e del gesto, con raccomandazioni di adeguamento e indicazioni personalizzate. In ufficio l'intervento è per persona; in produzione per postazione tipo.`,
    nota: `Non sostituisce la valutazione dei rischi ai sensi del D.Lgs. 81/2008, che resta di competenza del datore di lavoro e dell'RSPP.`,
    argomentario: `È il pilastro che agisce sul contesto invece che sulla persona: cambia la postazione, non solo la schiena. Il disclaimer non è una limitazione da nascondere — è ciò che ti tiene fuori dal perimetro dell'RSPP e rassicura chi teme sovrapposizioni.`,
  },
  {
    n: 8,
    nome: 'Review intermedie (mese 3 e 6)',
    cliente: `Due momenti di verifica con report di andamento: attività erogate, adesione, andamento degli indicatori, ritaratura del piano.`,
    argomentario: `Servono a te quanto a loro: sono i due momenti in cui il programma si corregge e in cui il cliente vede che qualcuno sta guidando. Un programma annuale senza checkpoint diventa invisibile entro marzo — e a novembre non si rinnova.`,
  },
  {
    n: 9,
    nome: 'Report annuale e verifica finale',
    cliente: `Nuovo check-up a 12 mesi e Report annuale con confronto rispetto alla fotografia iniziale: variazione della prevalenza, esiti dei cicli, andamento rispetto all'atteso di settore.`,
    argomentario: `È il documento che vende il rinnovo. Mostra numeri prima/dopo misurati con gli stessi strumenti — non impressioni. Anche in un'azienda che sta bene, dice qualcosa: la prevalenza si è mantenuta sotto l'atteso.`,
  },
  {
    n: 10,
    nome: 'Coordinamento e regia',
    cliente: `Un solo interlocutore per tutto il programma: pianificazione, professionisti, calendario, comunicazione interna, reportistica.`,
    argomentario: `È la voce che l'azienda sottovaluta finché non l'ha provata. La differenza tra ES Work e "un osteopata che viene il giovedì" è che qui nessuno in azienda deve organizzare niente. Per un titolare senza HR è spesso l'argomento decisivo.`,
  },
  {
    n: 11,
    nome: 'Piattaforma digitale ES Work',
    cliente: `Piattaforma digitale dedicata: check-up, cartella clinica del professionista, monitoraggio degli indicatori, report periodici alla direzione. L'azienda accede esclusivamente a dati aggregati.`,
    argomentario: `È ciò che rende il programma ripetibile e verificabile: senza, non potresti dimostrare nulla. Attenzione a non venderla come un software — il cliente compra la riduzione del mal di schiena, non la tecnologia.`,
  },
  {
    n: 12,
    nome: 'Documentazione OT23 INAIL',
    cliente: `Dossier con la documentazione necessaria alla richiesta di riduzione del premio assicurativo INAIL (Modello OT23), prodotto come parte del programma annuale.`,
    argomentario: `È la leva economica più concreta e la più sottovalutata: riduce il costo netto reale del programma e passa dalle mani del consulente del lavoro. Con gli intermediari è l'argomento di apertura; con il titolare è quello di chiusura.`,
  },
];

export const RIGA_CHIUSURA = `Tutte le componenti sono comprese nel programma annuale e dimensionate sui dati della vostra popolazione. Il tempo richiesto è di circa 4 ore l'anno per chi è in trattamento e 2 ore per tutti gli altri.`;

const eur = (v) => `€${Math.round(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;

// Sezione del Report di Attivazione (markdown). La scrive il sistema, NON l'AI: i testi
// restano quelli approvati. `servizi` = righe attive di servizi_deliverable per la
// configurazione dell'azienda: valori per singola voce, MAI un totale (regola del Listino).
export function cosaComprendeMarkdown({ servizi = [] } = {}) {
  const voci = VOCI_PROGRAMMA.map(v => `- **${v.n} · ${v.nome}.** ${v.cliente}${v.nota ? ` ${v.nota}` : ''}`).join('\n');
  const valori = servizi.length
    ? `\n\n**Valore dei servizi compresi** (valori annui per singola voce, già compresi nell'investimento):\n${servizi.map(s => `- ${s.voce}: ${eur(s.valore_dichiarato)}`).join('\n')}`
    : '';
  return `## Cosa comprende il programma\n\n${voci}\n\n${RIGA_CHIUSURA}${valori}`;
}

// Inserisce la sezione nel testo dell'AI prima delle Raccomandazioni (o dei Prossimi
// Passi); se l'AI non ha usato quei titoli, la mette in fondo.
export function inserisciCosaComprende(md, sezione) {
  if (!sezione) return md;
  const testo = md || '';
  for (const titolo of ['\n## Raccomandazioni', '\n## Prossimi Passi', '\n## Prossimi passi']) {
    const i = testo.indexOf(titolo);
    if (i >= 0) return `${testo.slice(0, i)}\n\n${sezione}\n${testo.slice(i)}`;
  }
  return `${testo.trimEnd()}\n\n${sezione}`;
}
