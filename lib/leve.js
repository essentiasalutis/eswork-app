// ─────────────────────────────────────────────────────────────────────────────
// Leve della presentazione del Report (punto 7) — modulo PURO. Testi e regole di Enrico
// (2026-09-11): due blocchi in quest'ordine, prima l'impatto (il perché), poi l'economia
// (il quanto); il blocco "Standard e sostenibilità" solo per il binario B.
// Verifiche fatte sulle fonti (guida INAIL OT23 2026; art. 100 TUIR):
//   OT23 = fino al 28% (fino a 10 lavoratori-anno), 18% (10,01–50), 10% (50,01–200),
//   5% (oltre 200); 8% fisso nei primi due anni della posizione INAIL.
//   Art. 100 TUIR = deducibile entro il 5 per mille se volontario; pieno se previsto da
//   regolamento aziendale o accordo.
// ─────────────────────────────────────────────────────────────────────────────

const eur = (v) => `€${Math.round(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
// "Nell'ordine di": arrotondato alle centinaia (alle decine sotto i 1.000 €).
const ordineDi = (v) => (v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10);

// Blocco 1 — Impatto organizzativo (perché riguarda l'azienda).
export function leveImpatto({ giorniMalattia } = {}) {
  const giorni = num(giorniMalattia);
  return [
    { titolo: 'Assenteismo', testo: 'I disturbi muscolo-scheletrici sono la prima causa di assenza prolungata in Italia.', dato: giorni ? `Nel vostro caso: circa ${Math.round(giorni)} giorni di malattia l'anno.` : null },
    { titolo: 'Presentismo', testo: 'La persona è al lavoro ma con dolore: produttività ridotta, errori, rallentamenti. È un costo invisibile che nessun indicatore aziendale cattura, e spesso supera quello delle assenze.' },
    { titolo: 'Attrattività e retention', testo: 'Un atto visibile di attenzione alle persone, in un mercato del lavoro in cui trattenere chi sa fare il mestiere è difficile.' },
    { titolo: 'Gestione del rischio', testo: 'I disturbi muscolo-scheletrici sono la prima voce di malattia professionale denunciata. Intervenire in modo documentato riduce l\'esposizione a contenziosi e denunce.' },
  ];
}

// Percentuale OT23 della fascia (lavoratori-anno ≈ dipendenti: stima, vedi nota per Enrico).
export function fasciaOT23(dipendenti) {
  const n = parseInt(dipendenti) || 0;
  if (n <= 10) return 28;
  if (n <= 50) return 18;
  if (n <= 200) return 10;
  return 5;
}

// Blocco 2 — Leve economiche (quanto vale). Mai euro accanto alle voci del programma: le
// sole cifre qui sono quelle che ABBASSANO il costo (OT23) e lo scenario delle assenze.
export function leveEconomiche({ dipendenti, premioInail, giorniMalattia, giorniMsk, incidenzaPct = 10, costoGiornata = 160 } = {}) {
  const out = [];
  const pct = fasciaOT23(dipendenti);
  const premio = num(premioInail);
  out.push({
    titolo: 'Riduzione del premio INAIL (OT23)',
    testo: `Per un'azienda della vostra dimensione la riduzione del tasso medio INAIL è fino al ${pct}%, se la domanda è accolta.`
      + (premio ? ` Sul vostro premio di circa ${eur(premio)} l'anno: fino a ${eur(premio * pct / 100)} l'anno, se la domanda è accolta.` : ''),
    nota: 'La documentazione è prodotta da noi, la domanda la presenta l\'azienda (o il consulente del lavoro).',
  });
  out.push({
    titolo: 'Deducibilità',
    testo: 'Se il programma è previsto da un regolamento aziendale o da un accordo, la spesa è interamente deducibile e non costituisce reddito per i dipendenti; se è offerto su base volontaria, è deducibile nei limiti dell\'art. 100 TUIR (5 per mille delle spese per il personale).',
    evidenza: 'Da confermare con il vostro commercialista.',
  });
  // Costo delle assenze: SOLO con il dato del colloquio, sempre scenario dichiarato, solo lordo.
  const msk = num(giorniMsk);
  const tot = num(giorniMalattia);
  const x = num(incidenzaPct) || 10;
  const costo = num(costoGiornata) || 160;
  if (msk) {
    out.push({
      titolo: 'Costo delle assenze',
      testo: `Avete circa ${Math.round(msk)} giorni di assenza l'anno legati a disturbi muscolo-scheletrici. Con un costo stimato di ${eur(costo)} per giornata, se il programma incidesse sul ${x}% delle assenze legate a disturbi muscolo-scheletrici, il risparmio sarebbe nell'ordine di ${eur(ordineDi(msk * costo * x / 100))} l'anno.`,
    });
  } else if (tot) {
    out.push({
      titolo: 'Costo delle assenze',
      testo: `Avete circa ${Math.round(tot)} giorni di malattia l'anno. Se anche solo una parte di queste assenze fosse legata a disturbi muscolo-scheletrici — ipotizzando un'incidenza del ${x}% e un costo stimato di ${eur(costo)} per giornata — il risparmio sarebbe nell'ordine di ${eur(ordineDi(tot * costo * x / 100))} l'anno.`,
    });
  }
  out.push({ titolo: 'Welfare aziendale', testo: 'Il programma si integra con i piani welfare aziendali.' });
  out.push({ titolo: 'Tempo richiesto', testo: 'Circa 4 ore l\'anno per chi è in trattamento, 2 per tutti gli altri: impatto minimo sull\'operatività.' });
  return out;
}

// Blocco opzionale — solo binario B (aziende strutturate che fanno rendicontazione).
export function leveSostenibilita() {
  return {
    titolo: 'Standard e sostenibilità',
    testo: 'Per le aziende che redigono la rendicontazione di sostenibilità, il programma produce azioni e indicatori documentati sulla salute dei lavoratori, i cui dati sono utilizzabili come fonte per la rendicontazione (GRI 403, ESRS S1), per i sistemi di gestione della salute e sicurezza (ISO 45001) e per i percorsi B Corp.',
    nota: 'ES Work non rilascia certificazioni: i dati prodotti sono progettati per essere compatibili con questi standard.',
  };
}

// Note per Enrico (mai al cliente): consigli e cautele da avere in mente mentre presenta.
export function noteLevePerEnrico({ dipendenti } = {}) {
  return [
    'Deducibilità piena: serve un regolamento aziendale o un accordo. È un\'azione loro, non nostra — ma è un consiglio che puoi dare e ti qualifica.',
    `OT23: la fascia (${fasciaOT23(dipendenti)}%) è stimata sui dipendenti; INAIL la calcola sui lavoratori-anno della posizione assicurativa. Nei primi due anni della posizione la riduzione è fissa all'8%.`,
  ];
}
