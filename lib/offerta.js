// Validità dell'offerta e promemoria a metà validità (punto 8 del funnel) — modulo PURO,
// usabile anche lato client. Binario A: scadenza = apertura + giorni del Listino; B e non
// deciso: nessuna scadenza salvo data messa a mano (decisione Enrico). Date 'YYYY-MM-DD'.
import { isYmd, aggiungiGiorni, ilGiorno, alGiorno } from './checkup';
import { normalizza } from './pipeline';

const GIORNO_MS = 86400000;

// "fino al 21 settembre 2026" / "fino all'8 settembre 2026" (documento e mail).
export function finoAl(ymd) { return isYmd(ymd) ? `fino ${alGiorno(ymd)} ${ymd.slice(0, 4)}` : ''; }

// Giorno a metà strada fra apertura e scadenza (arrotondato per difetto).
export function metaValidita(apertaIl, scadeIl) {
  if (!isYmd(apertaIl) || !isYmd(scadeIl) || scadeIl <= apertaIl) return null;
  const giorni = Math.round((Date.parse(`${scadeIl}T12:00:00Z`) - Date.parse(`${apertaIl}T12:00:00Z`)) / GIORNO_MS);
  return aggiungiGiorni(apertaIl, Math.floor(giorni / 2));
}

// Promemoria dovuto oggi: offerta aperta con scadenza, arrivata a metà validità, non
// ancora scaduta e non ancora sollecitata.
export function sollecitoOffertaDovuto(client, oggi) {
  if (!client || normalizza(client.pipeline_stage) !== 'offer_open' || client.offerta_sollecito_at) return false;
  const meta = metaValidita(client.offerta_aperta_il, client.offerta_scade_il);
  return !!meta && oggi >= meta && oggi <= client.offerta_scade_il;
}

// Frase di validità nella mail dell'offerta: "L'offerta è valida fino al 21 settembre 2026."
export function fraseValidita(scadeIl) {
  return isYmd(scadeIl) ? `L'offerta è valida ${finoAl(scadeIl)}.` : '';
}

// Mail del promemoria a metà validità (Enrico la invia dalla sua casella).
export function testoSollecitoOfferta({ azienda, referente, inviataIl, scadeIl }) {
  const inviata = isYmd(inviataIl) ? ` che le ho inviato ${ilGiorno(inviataIl)}` : '';
  const corpo = `Gentile ${referente || 'referente'},

le scrivo per sapere se ha avuto modo di valutare la proposta ES Work${inviata}. L'offerta resta valida fino ${alGiorno(scadeIl)}: se ci sono domande o aspetti da chiarire, sono disponibile per una breve telefonata.

Cordiali saluti,
Dott. Enrico Maiolo — Essentia Salutis · ES Work
Tel 327 102 7443 · info@essentiasalutis.it`;
  return { oggetto: `Proposta ES Work — ${azienda || 'la vostra azienda'}`, corpo };
}
