// ─────────────────────────────────────────────────────────────────────────────
// IL MASSIMO PROMESSO È IL MASSIMO — tetto della forbice. Modulo PURO (.mjs,
// testato da tests/): nessun import, così la regola si può provare da sola.
//
// Decisione di Enrico (14/9): il corrispettivo del PRIMO ANNO non supera il
// massimo della forbice della Stima, anche quando la prevalenza reale è più
// alta dell'atteso di settore. La forbice è l'unica promessa economica fatta
// prima del contratto — se può essere superata non è una forbice.
//
// Tre situazioni, e vanno distinte TUTTE E TRE a schermo: «dentro il tetto»,
// «tetto applicato» e «nessun tetto perché nessuna promessa» non sono la stessa
// cosa quando si rilegge un'offerta a settimane di distanza.
//
// L'Anno 2 non è capato: nasce da un nuovo check-up e da dati reali, è un'altra
// trattativa.
// ─────────────────────────────────────────────────────────────────────────────

export const STATI = {
  NESSUNA_FORBICE: 'nessuna_forbice',   // nessuna Stima emessa: niente promessa, niente tetto
  DENTRO: 'dentro',                     // il calcolato sta già dentro la forbice
  CAPATO: 'capato',                     // il calcolato supera il massimo → si propone il massimo
  SOPRA_AUTORIZZATO: 'sopra_autorizzato',// si esce dal tetto con conferma e motivazione registrate
};

// Il cuore della regola. `max` = massimo della forbice (null se non c'è Stima).
// `autorizzato` = conferma esplicita già data per QUESTA offerta.
export function prezzoConTetto({ calcolato, min = null, max = null, autorizzato = false } = {}) {
  const c = Number.isFinite(calcolato) ? calcolato : null;
  if (c == null) return { prezzo: null, stato: STATI.NESSUNA_FORBICE, calcolato: null, scostamento: 0, capApplicato: false };
  if (max == null) {
    return { prezzo: c, stato: STATI.NESSUNA_FORBICE, calcolato: c, scostamento: 0, capApplicato: false };
  }
  if (c <= max) {
    return { prezzo: c, stato: STATI.DENTRO, calcolato: c, scostamento: 0, capApplicato: false, min, max };
  }
  const scostamento = c - max;
  if (autorizzato) {
    return { prezzo: c, stato: STATI.SOPRA_AUTORIZZATO, calcolato: c, scostamento, capApplicato: false, min, max };
  }
  return { prezzo: max, stato: STATI.CAPATO, calcolato: c, scostamento, capApplicato: true, min, max };
}

// Riga per l'interfaccia interna (mai per il cliente): dice in una frase quale
// delle tre situazioni si sta guardando, con i numeri.
export function frasePerEnrico(r, eur = (v) => `€${Math.round(v || 0).toLocaleString('it-IT')}`) {
  if (!r) return '';
  if (r.stato === STATI.NESSUNA_FORBICE) {
    return 'Nessuna Stima emessa per questa azienda: non c\'è una forbice di riferimento, quindi nessun tetto è stato applicato.';
  }
  if (r.stato === STATI.DENTRO) {
    return `Dentro la forbice della Stima (${eur(r.min)} – ${eur(r.max)}): nessun tetto applicato.`;
  }
  if (r.stato === STATI.CAPATO) {
    return `Tetto applicato: il dimensionamento reale vale ${eur(r.calcolato)}, si propone il massimo promesso ${eur(r.max)} (${eur(r.scostamento)} assorbiti).`;
  }
  return `Sopra il massimo con autorizzazione: proposto ${eur(r.calcolato)} contro un massimo promesso di ${eur(r.max)} (${eur(r.scostamento)} oltre).`;
}

// I campi derivati dell'Anno 1 seguono il prezzo capato: mensile, per dipendente
// e totale con IVA. Senza questo, il documento mostrerebbe un totale capato e un
// «al mese» calcolato sul prezzo pieno — due numeri che non tornano.
export function applicaTettoAlCalcolo(calc, r, { contractMonths = 12, vatPct = 0.22 } = {}) {
  if (!calc || !r || !r.capApplicato) return calc;
  const n = calc.n || 0;
  const y1 = calc.y1 || {};
  return {
    ...calc,
    price_y1: r.prezzo,
    price_monthly_y1: Math.round(r.prezzo / contractMonths),
    price_per_employee_y1: n > 0 ? Math.round(r.prezzo / n) : calc.price_per_employee_y1,
    y1: { ...y1, total_sell: r.prezzo, total_with_vat: Math.round(r.prezzo * (1 + vatPct)) },
    // Traccia interna: il dimensionamento reale non si perde, serve al rinnovo.
    tetto: { applicato: true, calcolato: r.calcolato, massimo: r.max, scostamento: r.scostamento },
  };
}
