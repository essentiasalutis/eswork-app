// ─────────────────────────────────────────────────────────────────────────────
// Dati della Presentazione del Report e della Sintesi (punto 7). Numeri dalla STESSA fonte
// dell'Offerta (lib/offerta-server.js), riservatezza con le stesse soglie del Report
// (lib/kanon.js), quantità senza euro accanto alle voci (lib/programma.js), leve con i
// testi di Enrico (lib/leve.js). Tutto serializzabile: va nelle props della pagina.
// ─────────────────────────────────────────────────────────────────────────────
import { getClientById, getFirstMeeting } from './store';
import { statoCheckupCliente } from './checkup-server';
import { datiOffertaDaCheckup } from './offerta-server';
import { vistaRiservata } from './kanon';
import { quantitaPrimoAnno, VOCI_PROGRAMMA } from './programma';
import { leveImpatto, leveEconomiche, leveSostenibilita, noteLevePerEnrico } from './leve';
import { getOrgParams } from './org';
import { isFirmato } from './pipeline';
import { scartoLivello2 } from './offerta';

const vuoto = (v) => v == null || v === '';

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

  const s1 = (fm && fm.data && fm.data.step1) || {};
  const giorniMalattia = !vuoto(s1.absence_days) ? s1.absence_days : fm && fm.absence_days;
  const vista = vistaRiservata(d.nmq);
  const calc = d.calc;
  const f = d.forchetta;
  const prezzo = calc ? { y1: calc.price_y1, mese: calc.price_monthly_y1, dipendente: calc.price_per_employee_y1, y2: calc.price_y2 } : null;
  const inRange = f && prezzo && f.min != null && f.max != null ? (prezzo.y1 >= f.min && prezzo.y1 <= f.max) : null;
  const nuovoProgramma = (client.pricing_version || 'v1') === 'v2' && client.tipo_prodotto !== 'pacchetto_prevenzione';

  return {
    clientId,
    azienda: client.name,
    data: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }),
    binario: client.binario || null,
    firmato: isFirmato(client.pipeline_stage),
    dipendenti: parseInt(client.employees) || null,
    assessmentId: a.id,
    checkup: { risposte: d.responders, stato: stato.stato, chiude_il: a.chiude_il || null },
    vista: {
      pubblicabile: vista.pubblicabile,
      n: vista.n,
      livelli: vista.livelli,
      zoneTop: (vista.zone || []).filter(z => !z.soppressa && z.pct12 > 0).sort((x, y) => y.pct12 - x.pct12).slice(0, 3).map(z => ({ zone: z.zone, pct12: z.pct12 })),
      prevalenza: vista.prevalenza,
    },
    nuovoProgramma,
    quantita: quantitaPrimoAnno(calc, { mostraCicli: vista.l1Visibile }),
    voci: VOCI_PROGRAMMA.map(v => v.nome),
    prezzo,
    forchetta: f && f.min != null && f.max != null ? { min: f.min, max: f.max } : null,
    inRange,
    leve: {
      impatto: leveImpatto({ giorniMalattia }),
      economiche: leveEconomiche({
        dipendenti: client.employees, premioInail: s1.premio_inail, giorniMalattia, giorniMsk: s1.absence_days_msk,
        incidenzaPct: params.assenzeIncidenzaPct, costoGiornata: params.costoGiornataAssenza,
      }),
      sostenibilita: client.binario === 'B' ? leveSostenibilita() : null,
    },
    noteEnrico: noteLevePerEnrico({ dipendenti: client.employees }),
    // Solo per Enrico (controllo prima di presentare): mai sulle schermate del cliente.
    scartoL2: scartoLivello2({ nmq: d.nmq, calc, dipendenti: client.employees, l2Mult: d.l2Mult, soglia: params.scartoL2Soglia }),
  };
}
