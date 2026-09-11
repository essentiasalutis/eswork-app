// ─────────────────────────────────────────────────────────────────────────────
// Mail di riepilogo dopo il primo incontro (punto 4) e kit di comunicazione interna
// del check-up (punto 5) — modulo PURO (anche lato client). Testi di Enrico (settembre
// 2026), VERBATIM, con le sole modifiche decise da lui:
//   - riepilogo: "non entra nella fotografia" → "non rientra nell'analisi";
//   - kit: "rilevazione" → "check-up" (con l'accordo al maschile: "Il check-up è
//     gestito", "resta aperto");
//   - riga "Il documento della Stima è qui: {link}" dopo la forbice;
//   - firma del kit = "referente — azienda" (il kit lo manda l'azienda ai dipendenti).
// Il testo è una mail semplice: il grassetto dei titoletti non esiste, restano le parole.
// Il kit dice "stiamo valutando": vale PRIMA della firma (per chi ha firmato non si usa).
// ─────────────────────────────────────────────────────────────────────────────
import { isYmd, ilGiorno, alGiorno } from './checkup';
import { VOCI_PROGRAMMA } from './programma';

const eur = (v) => `€${Math.round(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
const FIRMA_ENRICO = `Dott. Enrico Maiolo — Essentia Salutis · ES Work
Tel 327 102 7443 · info@essentiasalutis.it`;
const entroIl = (ymd) => (isYmd(ymd) ? `entro ${ilGiorno(ymd)}` : 'entro la scadenza');
const finoAl = (ymd) => (isYmd(ymd) ? `fino ${alGiorno(ymd)}` : 'fino alla scadenza');

// Riga "Il punto di partenza" proposta dai dati del colloquio (Enrico la completa).
export function rigaContesto({ n, sector, absenceDays } = {}) {
  const persone = parseInt(n) || 0;
  if (!persone) return '';
  const prevalenza = sector === 'manufacturing' ? ', in prevalenza produzione'
    : sector === 'services' ? ', in prevalenza uffici'
      : sector === 'mix' ? ', tra produzione e uffici' : '';
  const giorni = parseInt(absenceDays) || 0;
  return `Siete ${persone} persone${prevalenza}${giorni > 0 ? `, con circa ${giorni} giorni di malattia l'anno` : ''}.`;
}

export function firmaKit({ referente, azienda } = {}) {
  return [referente, azienda].filter(Boolean).join(' — ');
}

// Kit di comunicazione interna — variante A (diretta, micro/familiare) o B (istituzionale).
export function testoKit({ variante = 'B', link, scadenza, firma } = {}) {
  if (variante === 'A') {
    return {
      oggetto: `Un check-up per la schiena — 5 minuti, ${entroIl(scadenza)}`,
      corpo: `Ciao a tutti,

stiamo valutando di attivare un programma per la salute muscolo-scheletrica: mal di schiena, cervicale, tensioni da postura. Prima di decidere vogliamo capire come stiamo davvero.

Vi chiediamo di compilare un breve check-up: meno di 5 minuti, dal telefono, al link qui sotto.

È riservato: le risposte individuali non le vede nessuno in azienda — noi riceviamo solo numeri complessivi. Se ne occupa Essentia Salutis, una rete di professionisti sanitari di Torino.

${link || ''}

Vi chiediamo di farlo ${entroIl(scadenza)}: chi non risponde entro quella data non rientra nel check-up.

Grazie,
${firma || ''}`,
    };
  }
  return {
    oggetto: `Check-up muscolo-scheletrico aziendale — richiesta di compilazione ${entroIl(scadenza)}`,
    corpo: `Gentili colleghe e colleghi,

l'azienda sta valutando l'attivazione di un programma dedicato alla prevenzione e al trattamento dei disturbi muscolo-scheletrici (lombalgie, cervicalgie, disturbi legati alla postura e alla movimentazione).

Il primo passo è un check-up conoscitivo: un questionario di meno di 5 minuti, compilabile da smartphone al link indicato di seguito.

Riservatezza. Il questionario è riservato: le risposte individuali non sono visibili all'azienda in alcuna forma. L'azienda riceve esclusivamente dati aggregati di popolazione, con soglie che impediscono l'identificazione dei singoli. Il check-up è gestito da Essentia Salutis (Torino), rete di professionisti sanitari, in qualità di titolare autonomo del trattamento.

${link || ''}

Il check-up resta aperto ${finoAl(scadenza)}. Chi non compila entro tale data non rientra nel check-up.

La compilazione è volontaria e non comporta alcun costo. L'esito della valutazione aziendale sarà comunicato successivamente.

Cordiali saluti,
${firma || ''}`,
  };
}

// Invito al check-up DOPO la firma (binario A: si firma prima del check-up). Testo di Enrico
// (11/9) dal kit A, con i suoi due ritocchi: il check-up decide chi riceve cosa (alza la
// partecipazione) e chi manca la scadenza non è escluso dal servizio. Vero in piattaforma:
// per un'azienda firmata il link del check-up, dopo la scadenza, resta aperto come adesione.
export function testoKitCheckupDopoFirma({ link, scadenza, firma } = {}) {
  return {
    oggetto: `Un check-up per la schiena — 5 minuti, ${entroIl(scadenza)}`,
    corpo: `Ciao a tutti,

abbiamo attivato un programma per la salute muscolo-scheletrica: mal di schiena, cervicale, tensioni da postura. Il primo passo è capire come stiamo davvero: il programma viene costruito sui risultati di questo check-up.

Vi chiediamo di compilare un breve check-up: meno di 5 minuti, dal telefono, al link qui sotto.

È riservato: le risposte individuali non le vede nessuno in azienda — noi riceviamo solo numeri complessivi. Se ne occupa Essentia Salutis, una rete di professionisti sanitari di Torino.

${link || ''}

Vi chiediamo di farlo ${entroIl(scadenza)}: chi non risponde entro quella data non rientra nella rilevazione iniziale. Il programma resta comunque per tutti, e sarà possibile segnalare disturbi anche in seguito.

Grazie,
${firma || ''}`,
  };
}

// Il kit dentro una mail: separato dal resto, con il suo oggetto.
export function bloccoKit(kit) {
  return `——————————————
TESTO DA INOLTRARE AI DIPENDENTI

Oggetto: ${kit.oggetto}

${kit.corpo}
——————————————`;
}

// Mail di riepilogo dopo il primo incontro.
export function testoRiepilogo({ referente, contesto, forchetta, urlStima, link, scadenza, secondoIncontro, binario, kit } = {}) {
  const voci = VOCI_PROGRAMMA.map(v => `• ${v.nome}`).join('\n');
  const documento = urlStima ? `Il documento della Stima è qui: ${urlStima}` : 'In allegato trovate il documento della Stima.';
  const lettera = binario === 'B'
    ? `\n\nLettera di incarico. In allegato trovate la Lettera di incarico, che formalizza quanto sopra: la forbice di investimento e le tempistiche. Non impegna all'attivazione del programma: serve a fissare per iscritto i termini della valutazione.`
    : '';
  const corpo = `Gentile ${referente || 'referente'},

grazie per il tempo di oggi. Riassumo quanto ci siamo detti, così avete tutto per iscritto.

Il punto di partenza. ${contesto ? `${contesto.trim()} ` : ''}Nel vostro settore i disturbi muscolo-scheletrici rappresentano la prima causa di assenza prolungata: è esattamente l'area su cui lavora il programma.

Cosa comprende il programma.
${voci}
Tempo richiesto: circa 4 ore l'anno per chi è in trattamento, 2 ore per tutti gli altri.

Stima di investimento. Sulla base dei vostri numeri, il programma si colloca tra ${eur(forchetta?.min)} e ${eur(forchetta?.max)} all'anno. Il preventivo preciso esce dal check-up, sui vostri dati reali, e resta all'interno di questa forbice.
${documento}

Il prossimo passo: il check-up. È a nostro carico. I dipendenti compilano un questionario riservato da smartphone, in meno di 5 minuti: l'azienda riceve esclusivamente dati aggregati, mai risposte individuali.
- Link da girare ai dipendenti: ${link || ''}
- Aperto ${finoAl(scadenza)}
- Trovate qui sotto il testo già pronto da inoltrare: non dovete scrivere nulla.

Chi non risponde entro la scadenza non rientra nell'analisi. Il programma, se attivato, resta ovviamente per tutti.

Ci rivediamo ${isYmd(secondoIncontro) ? ilGiorno(secondoIncontro) : '[data del secondo incontro]'}, come concordato: vi presenterò il Report di Attivazione — la fotografia della vostra popolazione, il piano di intervento e il preventivo definitivo.${lettera}

Resto a disposizione.

${FIRMA_ENRICO}${kit ? `\n\n\n${bloccoKit(kit)}` : ''}`;
  return { oggetto: 'ES Work — riepilogo e prossimi passi', corpo };
}
