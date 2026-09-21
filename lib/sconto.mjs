// ─────────────────────────────────────────────────────────────────────────────
// PREZZO APPLICATO PIÙ BASSO DEL CALCOLATO (sconto sull'Anno 1). Modulo PURO,
// testato. Decisioni di Enrico (21/9), sullo schema del tetto (lib/forbice.mjs).
//
//   · margine = (prezzo applicato − costo Anno 1) / prezzo applicato, sul costo
//     TOTALE: professionisti + 30% della quota. «Uno sconto che lo ignora ti fa
//     credere di guadagnare quando stai pagando il coordinamento di tasca tua.»
//   · sotto la soglia del Listino (sconto_margine_avviso_pct, 40%): avviso con il
//     margine risultante e conferma esplicita;
//   · sotto lo ZERO: rifiutato, senza eccezioni. Lo zero vive qui, non nel Listino:
//     è un limite che non deve spostarsi mai;
//   · vale per UN anno: tocca solo l'Anno 1; il rinnovo resta al prezzo pieno;
//   · il cliente vede solo il totale finale: niente «sconto», niente motivazione.
//
// Il tetto della forbice NON si blocca (è una promessa scritta): se porta il margine
// sotto la soglia è un avviso di REVISIONE dei parametri della forbice del settore.
// ─────────────────────────────────────────────────────────────────────────────

export const MARGINE_MINIMO_PCT = 0;          // limite fisso: mai sotto il costo
export const MOTIVO_MIN = 15;

const pct1 = x => Math.round(x * 10) / 10;
// Formati all'italiana, come fmt di lib/calculator.js (migliaia anche a 4 cifre).
export const eurIt = v => `€${Math.round(Number(v) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
export const pctIt = v => (v == null || !Number.isFinite(Number(v)) ? '—' : `${String(pct1(Number(v))).replace('.', ',')}%`);
// Preposizione articolata davanti a una percentuale, come si legge: «del 40%»,
// «dello 0%», «dell'8%», «dell'11%», «dell'85%»; con prep 'a': «al», «allo», «all'».
export function conArticolo(v, prep = 'de') {
  const n = Math.floor(Math.abs(Number(v)));
  const vocale = n === 1 || n === 8 || n === 11 || (n >= 80 && n <= 89);
  return `${n === 0 ? `${prep}llo ` : vocale ? `${prep}ll'` : `${prep}l `}${pctIt(v)}`;
}

export function margine(prezzo, costo) {
  const p = Number(prezzo), c = Number(costo);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(c)) return { margineEur: null, marginePct: null };
  return { margineEur: Math.round(p - c), marginePct: pct1(((p - c) / p) * 100) };
}

// Valuta uno sconto proposto. prezzoBase = Anno 1 dopo il tetto; costo = costo Anno 1.
// Ritorna { ok, stato, messaggio, scontoEur, scontoPct, margineEur, marginePct }.
// stato: 'valido' | 'serve_conferma' | 'sotto_costo' | 'non_inferiore' | 'non_valido' | 'motivo'
export function valutaSconto({ prezzoBase, prezzoScontato, costo, sogliaPct = 0.4, conferma = false, motivo = null, controllaMotivo = true }) {
  const base = Number(prezzoBase), p = Number(prezzoScontato), c = Number(costo);
  const esito = (ok, stato, messaggio, extra = {}) => ({ ok, stato, messaggio, ...extra });
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(c)) return esito(false, 'non_valido', 'Prezzo calcolato non disponibile.');
  if (!Number.isInteger(p) || p <= 0) return esito(false, 'non_valido', 'Scrivi il prezzo Anno 1 in euro interi.');
  const scontoEur = base - p;
  const scontoPct = pct1((scontoEur / base) * 100);
  const m = margine(p, c);
  const dati = { scontoEur, scontoPct, margineEur: m.margineEur, marginePct: m.marginePct, costo: Math.round(c) };
  if (p >= base) return esito(false, 'non_inferiore', `Il prezzo applicato deve essere più basso del calcolato (${eurIt(base)}).`, dati);
  if (m.marginePct < MARGINE_MINIMO_PCT) {
    return esito(false, 'sotto_costo', `Rifiutato: ${eurIt(p)} è sotto il costo dell'Anno 1 (${eurIt(c)}, professionisti e quota). Margine ${pctIt(m.marginePct)}.`, dati);
  }
  if (controllaMotivo && String(motivo || '').trim().length < MOTIVO_MIN) {
    return esito(false, 'motivo', `Scrivi la motivazione (almeno ${MOTIVO_MIN} caratteri): resta agli atti ed è interna.`, dati);
  }
  const soglia = pct1(sogliaPct * 100);
  if (m.marginePct < soglia && !conferma) {
    return esito(false, 'serve_conferma', `Margine ${conArticolo(m.marginePct)} (${eurIt(m.margineEur)}): sotto la soglia ${conArticolo(soglia)}. Conferma per registrarlo.`, dati);
  }
  return esito(true, 'valido', m.marginePct < soglia ? `Margine ${conArticolo(m.marginePct)}, sotto la soglia ${conArticolo(soglia)}: confermato.` : `Margine ${conArticolo(m.marginePct)}.`, { ...dati, sottoSoglia: m.marginePct < soglia });
}

// Lo sconto registrato si applica solo se il prezzo di partenza è ancora quello su
// cui è stato deciso. Se i dati sono cambiati (nuovo calcolato), è SOSPESO: va
// riconfermato, non applicato su numeri che non esistono più.
// cliente: la riga clients (colonne sconto_*); prezzoBase: Anno 1 dopo il tetto, ora.
export function statoScontoCliente(cliente, prezzoBase) {
  if (!cliente || cliente.sconto_prezzo_applicato == null) return { stato: 'nessuno' };
  const base = Math.round(Number(prezzoBase));
  const registrato = {
    prezzo: cliente.sconto_prezzo_applicato, calcolato: cliente.sconto_calcolato, costo: cliente.sconto_costo,
    marginePct: cliente.sconto_margine_pct != null ? Number(cliente.sconto_margine_pct) : null,
    rinnovoPieno: cliente.sconto_rinnovo_pieno, motivo: cliente.sconto_motivo, at: cliente.sconto_at,
    conferma: !!cliente.sconto_conferma_margine,
  };
  if (!Number.isFinite(base) || base !== Number(cliente.sconto_calcolato)) return { stato: 'sospeso', registrato, baseAttuale: Number.isFinite(base) ? base : null };
  return { stato: 'attivo', registrato };
}

// Il prezzo applicato scende nell'Anno 1 e nei suoi derivati (mensile, per
// dipendente, totale con IVA). L'Anno 2 resta pieno. Traccia interna in `sconto`.
// L'IVA segue quella del calcolo (regime forfettario: zero), mai un'aliquota fissa.
export function applicaScontoAlCalcolo(calc, stato, { contractMonths = 12 } = {}) {
  if (!calc || !stato || stato.stato !== 'attivo') return calc;
  const p = stato.registrato.prezzo;
  const n = calc.n || 0;
  const y1 = calc.y1 || {};
  const ivaCalc = Number.isFinite(y1.vat) ? y1.vat : (Number(y1.total_with_vat) || 0) - (Number(y1.total_sell) || 0);
  const quotaIva = y1.total_sell > 0 ? Math.max(0, ivaCalc) / y1.total_sell : 0;
  return {
    ...calc,
    price_y1: p,
    price_monthly_y1: Math.round(p / contractMonths),
    price_per_employee_y1: n > 0 ? Math.round(p / n) : calc.price_per_employee_y1,
    y1: { ...y1, total_sell: p, vat: Math.round(p * quotaIva), total_with_vat: Math.round(p * (1 + quotaIva)) },
    sconto: { applicato: true, prezzoPrima: stato.registrato.calcolato, prezzo: p, marginePct: stato.registrato.marginePct },
  };
}

// Avviso di revisione dei parametri della forbice: il TETTO (non uno sconto) porta
// il margine sotto la soglia. r = esito di prezzoConTetto; costo = costo Anno 1.
export function avvisoRevisioneForbice(r, costo, sogliaPct = 0.4) {
  if (!r || !r.capApplicato) return null;
  const m = margine(r.prezzo, costo);
  const soglia = pct1(sogliaPct * 100);
  if (m.marginePct == null || m.marginePct >= soglia) return null;
  return { marginePct: m.marginePct, margineEur: m.margineEur, sogliaPct: soglia, calcolato: r.calcolato, massimo: r.max, costo: Math.round(costo) };
}

// Riga per il riquadro del rinnovo (solo vista amministratore).
export function rigaRinnovo(stato, eur = eurIt) {
  if (!stato || stato.stato === 'nessuno') return null;
  const r = stato.registrato;
  const salto = (r.rinnovoPieno || 0) - r.prezzo;
  return `Anno 1 applicato ${eur(r.prezzo)} (sconto ${eur(r.calcolato - r.prezzo)}, margine ${pctIt(r.marginePct)}) · Rinnovo a prezzo pieno ${eur(r.rinnovoPieno)}: ${salto >= 0 ? '+' : '−'}${eur(Math.abs(salto))} rispetto all'Anno 1 applicato.`;
}
