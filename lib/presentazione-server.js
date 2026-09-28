// ─────────────────────────────────────────────────────────────────────────────
// Dati della Presentazione del Report (punto 7). Numeri dalla STESSA fonte
// dell'Offerta (lib/offerta-server.js), riservatezza con le stesse soglie del Report
// (lib/kanon.js), quantità senza euro accanto alle voci (lib/programma.js), leve con i
// testi di Enrico (lib/leve.js). Tutto serializzabile: va nelle props della pagina.
// ─────────────────────────────────────────────────────────────────────────────
import { getClientById, getFirstMeeting } from './store';
import { statoCheckupCliente } from './checkup-server';
import { datiOffertaDaCheckup } from './offerta-server';
import { vistaRiservata } from './kanon';
import { quantitaPrimoAnno } from './programma';
import { leveImpatto, leveEconomiche, leveSostenibilita, noteLevePerEnrico } from './leve';
import { getOrgParams } from './org';
import { isFirmato } from './pipeline';
import { dataIt } from './date-it.mjs';
import { pianoPerLivello, prossimiPassi } from './presentazione-testi.mjs';
import { spiegazioneAnno2 } from './anno2.mjs';
import { zoneDaMostrare } from './distretti';
import { scadenzaOffertaProposta } from './offerta';

const vuoto = (v) => v == null || v === '';

// Testi condivisi da Presentazione e Offerta — «deve essere tutto unico tra
// presentazione e preventivo» (Enrico, 27/9). Un solo calcolo: zone, piano, Anno 2,
// leve, data dell'offerta. `d` = datiOffertaDaCheckup, `fm` = colloquio, `params` = Listino.
export function testiCondivisi({ client, d, fm, params }) {
  const s1 = (fm && fm.data && fm.data.step1) || {};
  const giorniMalattia = !vuoto(s1.absence_days) ? s1.absence_days : fm && fm.absence_days;
  const calc = d.calc;
  const nuovoProgramma = (client.pricing_version || 'v1') === 'v2' && client.tipo_prodotto !== 'pacchetto_prevenzione';
  const pacchetto = client.tipo_prodotto === 'pacchetto_prevenzione';
  const ergonomiaNelPrezzo = !!(calc && calc.y1 && calc.y1.ergonomia && calc.y1.ergonomia.sell > 0);
  const conTetto = !!(d.tetto && d.tetto.capApplicato);
  return {
    nuovoProgramma,
    pacchetto,
    // Tutte le zone, come nel report (Enrico, 27/9): niente conteggi sotto soglia.
    zone: zoneDaMostrare(d.nmq),
    // Cosa riceve ciascun livello (Enrico, 27/9), al posto delle quantità.
    piano: nuovoProgramma ? pianoPerLivello({ ergonomia: ergonomiaNelPrezzo }) : null,
    anno2: calc ? spiegazioneAnno2({ calc, conTetto }) : null,
    scadenzaOfferta: scadenzaOffertaProposta(client, (params && params.offertaGiorni) || 10),
    leve: {
      impatto: leveImpatto({ giorniMalattia }),
      economiche: leveEconomiche({
        dipendenti: client.employees, premioInail: s1.premio_inail, giorniMalattia, giorniMsk: s1.absence_days_msk,
        incidenzaPct: params && params.assenzeIncidenzaPct, costoGiornata: params && params.costoGiornataAssenza,
      }),
      // Sempre calcolato: è la pagina Presenta a decidere se mostrarlo (spunta,
      // default spento). Non è più legato a un attributo dell'azienda.
      sostenibilita: leveSostenibilita(),
    },
  };
}

export async function datiPresentazione(clientId) {
  const client = await getClientById(clientId).catch(() => null);
  if (!client) return { errore: 'Azienda non trovata.' };
  const stato = await statoCheckupCliente(client).catch(() => null);
  const a = stato && stato.assessment;
  if (!a) return { errore: 'Questa azienda non ha ancora un check-up: la presentazione parte dai suoi risultati.', azienda: client.name, clientId };

  const [d, fm, params] = await Promise.all([
    datiOffertaDaCheckup({ assessmentId: a.id, n: client.employees }),
    getFirstMeeting(clientId).catch(() => null),
    getOrgParams(),
  ]);
  if (!d) return { errore: 'Check-up non trovato.', azienda: client.name, clientId };
  if (d.errore) return { errore: d.errore, azienda: client.name, clientId };   // tariffe mancanti (21/9)

  const t = testiCondivisi({ client, d, fm, params });
  const vista = vistaRiservata(d.nmq);
  const calc = d.calc;
  const f = d.forchetta;
  // Niente prezzo per dipendente: non si mostra in nessun documento (Enrico, 27/9).
  const prezzo = calc ? { y1: calc.price_y1, mese: calc.price_monthly_y1, y2: calc.price_y2 } : null;
  const inRange = f && prezzo && f.min != null && f.max != null ? (prezzo.y1 >= f.min && prezzo.y1 <= f.max) : null;
  const { nuovoProgramma, pacchetto } = t;
  const firmato = isFirmato(client.pipeline_stage);

  return {
    clientId,
    azienda: client.name,
    data: dataIt(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }),
    dipendenti: parseInt(client.employees) || null,
    assessmentId: a.id,
    checkup: { risposte: d.responders, stato: stato.stato, chiude_il: a.chiude_il || null },
    // C'è un Report di Attivazione di questo check-up? La presentazione nasce da lui (28/9).
    reportAttivazione: !!stato.reportDopo,
    vista: {
      pubblicabile: vista.pubblicabile,
      n: vista.n,
      livelli: vista.livelli,
      // Tutte le zone (o i tre distretti), dalla più colpita, come nel report (27/9).
      zone: t.zone,
      prevalenza: vista.prevalenza,
    },
    nuovoProgramma,
    quantita: quantitaPrimoAnno(calc, { mostraCicli: vista.l1Visibile }),
    // Presentazione (Enrico, 27/9): cosa riceve ciascun livello, al posto delle quantità.
    piano: t.piano,
    // Stessa data di scadenza dell'Offerta (accettazione, poi contratto entro 15 giorni).
    prossimiPassi: pacchetto ? null : prossimiPassi({ firmato, scadenzaOfferta: t.scadenzaOfferta }),
    anno2: t.anno2,
    prezzo,
    forchetta: f && f.min != null && f.max != null ? { min: f.min, max: f.max } : null,
    inRange,
    // Solo per il controllo di Enrico prima di presentare (mai a schermo per il cliente).
    posizione: d.posizione || null,
    scontoStato: d.sconto ? d.sconto.stato : 'nessuno',
    leve: t.leve,
    noteEnrico: noteLevePerEnrico({ dipendenti: client.employees }),
  };
}
