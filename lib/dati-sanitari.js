import { K_ANON, ND_POCHI, livelliLeggibili, nomeCella, NOTA_LIVELLI_UNITI, NOTA_NESSUNA_DISTRIBUZIONE } from './kanon';
import { CARTE_LIVELLO as LIVELLI, azioneLivello } from './livelli';
import { ilPct } from './articoli.mjs';
// Dati aggregati del check-up per il medico competente (Enrico, 21/9): una pagina A4 con
// partecipazione, zone, prevalenza e livelli. Modulo PURO: riceve SOLO i campi sanitari di
// datiPresentazione (stessi numeri e stessa riservatezza del Report). Qui c'era anche la
// «Sintesi» da lasciare all'azienda: tolta il 28/9 (Enrico: «non ha senso»), al cliente
// resta la presentazione in PDF.
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STILE_PRIMA = `
  @page { size: A4; margin: 14mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.5; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #16a34a; padding-bottom: 10px; margin-bottom: 16px; }
  .brand { font-size: 24px; font-weight: 800; } .brand span { color: #16a34a; }
  .tit { text-align: right; } .tit .k { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; } .tit .v { font-size: 16px; font-weight: 800; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #16a34a; margin: 14px 0 6px; }
  .big { font-size: 15px; font-weight: 700; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .liv { border: 1.5px solid; border-radius: 10px; padding: 10px; }
  .lv-n { font-size: 22px; font-weight: 800; line-height: 1.1; } .lv-t { font-weight: 700; font-size: 11px; margin-top: 2px; } .lv-d { font-size: 10.5px; color: #475569; }
  ul { margin-left: 16px; } li { margin-bottom: 2px; }
`;
const STILE_DOPO = `  .foot { margin-top: 18px; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .muted { color: #64748b; font-size: 11px; }
`;
export const STILE_SANITARIO = STILE_PRIMA + STILE_DOPO;

// Blocchi SANITARI: partecipazione, zone, prevalenza, livelli (Enrico, 21/9: stessi dati,
// stesse funzioni, stesse soglie dell'azienda). Nessun importo, nessuna quantità dell'offerta.
// Livelli sotto soglia UNITI in un solo dato (Enrico, 27/9): mai «n.d.» livello per livello.
function bloccoLivelli(d) {
  const v = d.vista || {};
  if (!v.pubblicabile || !v.livelli) return '';
  const L = livelliLeggibili(v.livelli, v.n);
  if (L.nessunaDistribuzione) return `<div class="muted">${NOTA_NESSUNA_DISTRIBUZIONE}</div>`;
  const azioneDi = k => azioneLivello(k, { nuovoProgramma: d.nuovoProgramma }).toLowerCase();
  const celle = L.celle.map(c => {
    const m = c.unite ? { color: '#475569', bg: '#f8fafc' } : LIVELLI[c.keys[0]];
    const desc = c.keys.map(k => `${LIVELLI[k].desc} — ${azioneDi(k)}`).join(' · ');
    return `<div class="liv" style="background:${m.bg};border-color:${m.color}"><div class="lv-n" style="color:${m.color}">${c.pct}%</div><div class="lv-t">${nomeCella(c)}</div><div class="lv-d">${desc}</div></div>`;
  }).join('');
  return `<div class="grid3" style="grid-template-columns:repeat(${L.celle.length}, 1fr)">${celle}</div>${L.unite ? `<div class="muted" style="margin-top:6px">${NOTA_LIVELLI_UNITI}</div>` : ''}`;
}

export function blocchiSanitari(d) {
  const v = d.vista || {};
  const partecipazione = d.dipendenti ? `${d.checkup.risposte} su ${d.dipendenti} dipendenti (${Math.round((d.checkup.risposte / d.dipendenti) * 100)}%)` : `${d.checkup.risposte} dipendenti`;
  const livelli = bloccoLivelli(d);
  // Tutte le zone (o i tre distretti), come nel report e nella presentazione (27/9).
  const Z = v.zone || { righe: [] };
  const zone = Z.righe.map(z => `${esc(z.zone)} ${z.soppressa ? esc(ND_POCHI) : `${z.pct12}%`}`).join(' · ');
  return `  <h2>La fotografia</h2>
  ${v.pubblicabile
    ? `<div class="big">${partecipazione} hanno compilato il check-up.</div>${zone ? `<div>Disturbi negli ultimi 12 mesi, per ${Z.aggrega ? 'distretto' : 'zona'}: ${zone}.</div>${Z.nota ? `<div class="muted">${esc(Z.nota)}</div>` : ''}` : ''}${v.prevalenza != null ? `<div class="muted">${ilPct(v.prevalenza, { maiuscola: true })} riporta almeno un disturbo negli ultimi 12 mesi.</div>` : ''}`
    : `<div>Risultati aggregati non pubblicabili: meno di ${K_ANON} risposte. A tutela della riservatezza i risultati si mostrano solo con almeno ${K_ANON} risposte.</div>`}

  ${livelli ? `<h2>La stratificazione</h2>${livelli}` : ''}

`;
}

// ─── Per il medico competente (Enrico, 21/9, strada 1) ───────────────────────────
// Stessi dati e stesse soglie dell'azienda (datiPresentazione → vistaRiservata),
// senza le sezioni commerciali: niente programma/quantità, niente investimento,
// niente forbice, niente leve economiche. Riceve SOLO i campi sanitari
// (datiSanitariSintesi): il prezzo non arriva nemmeno a questa funzione.
export function datiSanitariSintesi(d) {
  return {
    azienda: d.azienda, data: d.data, dipendenti: d.dipendenti,
    checkup: { risposte: d.checkup && d.checkup.risposte },
    vista: d.vista, nuovoProgramma: d.nuovoProgramma,
  };
}

export function buildSintesiSanitariaHtml(ds) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><style>${STILE_SANITARIO}</style></head><body>
  <div class="top">
    <div><div class="brand">ES <span>Work</span></div><div class="muted">by Essentia Salutis</div></div>
    <div class="tit"><div class="k">Dati aggregati del check-up</div><div class="v">${esc(ds.azienda)}</div><div class="muted">${esc(ds.data)}</div></div>
  </div>

${blocchiSanitari(ds)}
  <div class="foot">Dati del check-up in forma aggregata e riservata: i gruppi con meno di ${K_ANON} persone non sono mostrati. Nessun dato individuale.</div>
</body></html>`;
}
