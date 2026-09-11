// Mail "Invia al referente" della Stima di investimento — modulo PURO (anche lato client).
// Testo = paragrafo "Stima di investimento" della mail di riepilogo di Enrico (settembre
// 2026). Al punto 4 del funnel verrà sostituito dalla mail di riepilogo completa.
const eur = (v) => `€${Math.round(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;

export function testoMailStima({ azienda, referente, forchetta, pacchetto, url }) {
  const nomeAzienda = azienda && azienda !== '—' ? azienda : 'la vostra azienda';
  const prezzo = pacchetto
    ? `Il Pacchetto d'ingresso ha un investimento di ${eur(pacchetto.price)} per 12 mesi.`
    : `Sulla base dei vostri numeri, il programma si colloca tra ${eur(forchetta?.min?.price_y1)} e ${eur(forchetta?.max?.price_y1)} all'anno. Il preventivo preciso esce dal check-up, sui vostri dati reali, e resta all'interno di questa forbice.`;
  const corpo = `Gentile ${referente || 'referente'},

le invio la Stima di investimento per ${nomeAzienda}. ${prezzo}
${url ? `\nIl documento è qui: ${url}\n` : '\n(allego il documento)\n'}
Resto a disposizione.

Dott. Enrico Maiolo — Essentia Salutis · ES Work
Tel 327 102 7443 · info@essentiasalutis.it`;
  return { oggetto: `ES Work — Stima di investimento per ${nomeAzienda}`, corpo };
}
