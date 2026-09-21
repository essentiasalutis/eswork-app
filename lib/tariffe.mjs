// ─────────────────────────────────────────────────────────────────────────────
// TARIFFE della Stima — nessun valore di riserva silenzioso (Enrico, 21/9).
//
// Una Stima con importi a zero che arriva a un cliente è peggio di un errore: se una
// tariffa manca, non è un numero o vale zero, la Stima si rifiuta e dice quale. Prima
// un elenco di tariffe vuoto dava €0 in tutti gli scenari, e l'assenza delle tariffe
// faceva usare in silenzio quelle standard: stesso difetto del segreto di sessione.
// Lo zero conta come mancante: nella scheda del colloquio un campo svuotato diventa 0.
// ─────────────────────────────────────────────────────────────────────────────
export const TARIFFE = Object.freeze([
  ['sportello_sell', 'sportello, vendita (€/ora)'],
  ['sportello_cost', 'sportello, costo (€/ora)'],
  ['prevalidation_sell', 'pre-validazione, vendita'],
  ['prevalidation_cost', 'pre-validazione, costo'],
  ['training_sell', 'formazione, vendita (a modulo)'],
  ['training_cost', 'formazione, costo (a modulo)'],
]);

export function tariffeMancanti(rates) {
  const r = rates && typeof rates === 'object' ? rates : {};
  return TARIFFE.filter(([k]) => !(Number.isFinite(Number(r[k])) && Number(r[k]) > 0 && r[k] !== '' && r[k] !== null)).map(([, etichetta]) => etichetta);
}

export const messaggioTariffe = mancanti =>
  `Tariffe mancanti o a zero: ${mancanti.join('; ')}. Apri la Stima dalla scheda del colloquio e controlla le tariffe.`;
// Nella scheda del colloquio stessa: le tariffe si correggono lì sotto.
export const messaggioTariffeScheda = mancanti =>
  `Tariffe mancanti o a zero: ${mancanti.join('; ')}. Le trovi qui sotto, in «Parametri della Stima».`;

// Seconda difesa, sul risultato: nessuno scenario a zero o non numerico.
export function scenariValidi(forchetta) {
  return !!forchetta && ['min', 'avg', 'max'].every(k => {
    const v = forchetta[k] && forchetta[k].price_y1;
    return Number.isFinite(v) && v > 0;
  });
}
export const MESSAGGIO_IMPORTI_ZERO = 'Stima non generata: il calcolo ha dato un importo a zero. Controlla le tariffe e i dati della scheda del colloquio.';

// Il MOTORE non ripiega più sulle tariffe standard (Enrico, 21/9): senza tariffe
// complete si ferma con un errore che dice quali mancano. Chi lo chiama intercetta
// l'errore e dice anche DOVE mancano (Stima congelata, scheda del colloquio).
export class TariffeMancanti extends Error {
  constructor(mancanti) {
    super(messaggioTariffe(mancanti));
    this.name = 'TariffeMancanti';
    this.mancanti = mancanti;
  }
}
export function verificaTariffe(rates) {
  const m = tariffeMancanti(rates);
  if (m.length) throw new TariffeMancanti(m);
  return rates;
}
// Messaggio per report e Offerta: quali tariffe e dove si sono cercate.
export const messaggioTariffeDove = (mancanti, dove) =>
  `Tariffe mancanti o a zero ${dove}: ${mancanti.join('; ')}. Completale lì e riprova.`;
