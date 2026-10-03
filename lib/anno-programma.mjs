// ─────────────────────────────────────────────────────────────────────────────
// ANNO DI PROGRAMMA — i diritti annuali si contano qui. Modulo PURO (.mjs, testato).
//
// Decisione di Enrico (17/9): «Il programma è annuale e decorre dall'avvio: se
// un'azienda parte a ottobre, il suo anno finisce a ottobre.» Prima i limiti
// contavano TUTTO lo storico (2 cicli «per anno», 1 prevenzione «annuale») oppure
// l'anno solare in UTC: dal secondo anno il cliente pagava un rinnovo e trovava il
// servizio esaurito.
//
// Vale per: cicli di trattamento (2), ciclo di prevenzione (1), auto-segnalazioni
// del dipendente (2), capacità contrattuale dell'azienda.
// I confini sono GIORNI ITALIANI: l'anno inizia a mezzanotte a Roma.
// Il primo anno include anche quanto avvenuto prima della data di avvio.
// ─────────────────────────────────────────────────────────────────────────────
import { giornoIt, inizioGiornoIt, aggiungiAnni, dataIt } from './date-it.mjs';
import { PROTOCOLLO } from './protocollo.mjs';

export const MAX_CICLI_TRATTAMENTO = PROTOCOLLO.cicli_trattamento_per_anno;
export const MAX_CICLI_PREVENZIONE = PROTOCOLLO.cicli_prevenzione_per_anno;
export const MAX_AUTOSEGNALAZIONI = PROTOCOLLO.autosegnalazioni_per_anno;

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

// Finestra dell'anno di programma in corso. null se la data di avvio manca.
export function finestraAnno(dataAvvio, adesso = new Date()) {
  if (typeof dataAvvio !== 'string' || !GIORNO.test(dataAvvio)) return null;
  const oggi = giornoIt(adesso);
  let n = 0;
  while (aggiungiAnni(dataAvvio, n + 1) <= oggi) n += 1;
  const inizioGiorno = aggiungiAnni(dataAvvio, n);
  const rinnovoIl = aggiungiAnni(dataAvvio, n + 1);
  return {
    numero: n + 1,
    inizioGiorno,
    rinnovoIl,
    inizio: n === 0 ? null : inizioGiornoIt(inizioGiorno).toISOString(),   // primo anno: aperto all'indietro
    fine: inizioGiornoIt(rinnovoIl).toISOString(),
  };
}

// Un istante sta nell'anno di programma? Senza finestra (data di avvio assente)
// conta tutto: nel primo anno è comunque giusto, e il messaggio dice perché non si rinnova.
export function nellAnno(istante, finestra) {
  if (!finestra) return true;
  const t = Date.parse(istante);
  if (!Number.isFinite(t)) return true;
  if (finestra.inizio && t < Date.parse(finestra.inizio)) return false;
  return t < Date.parse(finestra.fine);
}

const ETICHETTE = {
  treatment: { una: 'ciclo di trattamento', piu: 'cicli di trattamento' },
  prevention: { una: 'ciclo di prevenzione', piu: 'cicli di prevenzione' },
};

// Cicli di un tipo avviati nell'anno di programma, e se il diritto è esaurito.
export function dirittoCicli({ cicli = [], tipo, finestra }) {
  const max = tipo === 'prevention' ? MAX_CICLI_PREVENZIONE : MAX_CICLI_TRATTAMENTO;
  const usati = (cicli || []).filter(c => (c.cycle_type || 'treatment') === tipo && c.status !== 'active' && c.status !== 'pending_pgic'
    && nellAnno(c.started_at || c.created_at, finestra)).length;
  const esaurito = usati >= max;
  const e = ETICHETTE[tipo];
  let messaggio = null;
  if (esaurito) {
    const quanti = `${usati} ${usati === 1 ? e.una : e.piu} su ${max}`;
    messaggio = finestra
      ? `Diritto esaurito per quest'anno di programma: ${quanti} (anno ${finestra.numero}, dal ${dataIt(finestra.inizioGiorno)}). Si rinnova il ${dataIt(finestra.rinnovoIl)}.`
      : `Diritto esaurito: ${quanti}. La data di avvio del programma dell'azienda non è impostata, quindi l'anno di programma non si può calcolare e il diritto non si rinnova: va impostata nella scheda azienda.`;
  }
  return { usati, max, esaurito, messaggio, rinnovoIl: finestra ? finestra.rinnovoIl : null };
}
