import { K_ANON } from './kanon';
import { DICITURA_IVA } from './iva.mjs';
// Sintesi del Report di Attivazione (punto 7): la "prima pagina" da lasciare, una pagina A4.
// Modulo PURO: riceve i dati di datiPresentazione (stessi numeri dell'Offerta, stessa
// riservatezza del Report). Niente euro accanto alle voci: le quantità e l'investimento.
const eur = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LIVELLI = {
  l1: { nome: 'Livello 1', desc: 'Dolore con impatto funzionale', azione: 'cicli clinici', color: '#dc2626', bg: '#fef2f2' },
  l2: { nome: 'Livello 2', desc: 'Segnali senza impatto', azione: 'prevenzione', color: '#ca8a04', bg: '#fffbeb' },
  l3: { nome: 'Livello 3', desc: 'Nessun disturbo in atto', azione: 'formazione', color: '#16a34a', bg: '#f0fdf4' },
};

// Stile comune della Sintesi (azienda e medico competente).
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
// Solo per il riquadro dell'investimento: non entra nel documento del medico competente.
const STILE_COMMERCIALE = `  .inv { background: #16a34a; color: #fff; border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .inv .eur { font-size: 26px; font-weight: 800; } .inv .sub { font-size: 11px; opacity: .95; }
  .y2 { font-size: 11px; color: #334155; margin-top: 6px; }
`;
const STILE_DOPO = `  .next { background: #f8fafc; border-left: 4px solid #16a34a; padding: 10px 14px; border-radius: 0 10px 10px 0; }
  .foot { margin-top: 18px; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .muted { color: #64748b; font-size: 11px; }
`;
const STILE = STILE_PRIMA + STILE_COMMERCIALE + STILE_DOPO;
export const STILE_SANITARIO = STILE_PRIMA + STILE_DOPO;

// Blocchi SANITARI della Sintesi: partecipazione, zone, prevalenza, livelli. Gli
// stessi per l'azienda e per il medico competente (Enrico, 21/9: stessi dati, stesse
// funzioni, stesse soglie). Nessun importo, nessuna quantità dell'offerta.
function bloccoLivelli(d) {
  const v = d.vista || {};
  return v.pubblicabile && v.livelli ? v.livelli.map(c => {
    const m = LIVELLI[c.key];
    const azione = c.key === 'l2' && d.nuovoProgramma ? 'prevenzione dal primo anno' : m.azione;
    return `<div class="liv" style="background:${m.bg};border-color:${m.color}"><div class="lv-n" style="color:${m.color}">${c.suppressed ? 'n.d.' : `${c.pct}%`}</div><div class="lv-t">${m.nome}</div><div class="lv-d">${m.desc} — ${azione}</div></div>`;
  }).join('') : '';
}

export function blocchiSanitari(d) {
  const v = d.vista || {};
  const partecipazione = d.dipendenti ? `${d.checkup.risposte} su ${d.dipendenti} dipendenti (${Math.round((d.checkup.risposte / d.dipendenti) * 100)}%)` : `${d.checkup.risposte} dipendenti`;
  const livelli = bloccoLivelli(d);
  const zone = v.zoneTop && v.zoneTop.length ? v.zoneTop.map(z => `${esc(z.zone)} ${z.pct12}%`).join(' · ') : '';
  return `  <h2>La fotografia</h2>
  ${v.pubblicabile
    ? `<div class="big">${partecipazione} hanno compilato il check-up.</div>${zone ? `<div>Zone più colpite negli ultimi 12 mesi: ${zone}.</div>` : ''}${v.prevalenza != null ? `<div class="muted">Il ${v.prevalenza}% riporta almeno un disturbo negli ultimi 12 mesi.</div>` : ''}`
    : `<div>Risultati aggregati non pubblicabili: meno di ${K_ANON} risposte. A tutela della riservatezza i risultati si mostrano solo con almeno ${K_ANON} risposte.</div>`}

  ${livelli ? `<h2>La stratificazione</h2><div class="grid3">${livelli}</div>` : ''}

`;
}

export function buildSintesiHtml(d) {
  const p = d.prezzo;
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><style>${STILE}</style></head><body>
  <div class="top">
    <div><div class="brand">ES <span>Work</span></div><div class="muted">by Essentia Salutis</div></div>
    <div class="tit"><div class="k">Sintesi — Report di Attivazione</div><div class="v">${esc(d.azienda)}</div><div class="muted">${esc(d.data)}</div></div>
  </div>

${blocchiSanitari(d)}  <h2>Il vostro programma nel primo anno</h2>
  ${d.quantita && d.quantita.length ? `<ul>${d.quantita.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : `<div>${d.voci.map(esc).join(' · ')}</div>`}

  ${p ? `<h2>L'investimento</h2>
  <div class="inv"><div><div class="sub">Anno 1 — programma completo</div><div class="eur">${eur(p.y1)}</div></div><div class="sub" style="text-align:right">${eur(p.mese)} al mese<br>${eur(p.dipendente)} per dipendente</div></div>
  <div class="y2">Anno 2 e successivi (indicativo): <strong>${eur(p.y2)}</strong> l'anno.${d.inRange && d.forchetta ? ` Dentro la forbice della Stima di investimento presentata al colloquio (${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}).` : ''}</div>
  <div class="y2">${DICITURA_IVA}</div>` : ''}

  <h2>Il prossimo passo</h2>
  <div class="next">${d.firmato ? 'Avvio del programma in sede secondo il calendario concordato.' : 'Firma del contratto e avvio del programma.'}</div>

  <div class="foot">Dati del check-up in forma aggregata e riservata: i gruppi con meno di ${K_ANON} persone non sono mostrati. · Essentia Salutis · ES Work · Tel 327 102 7443 · info@essentiasalutis.it</div>
</body></html>`;
}

// ─── Sintesi SANITARIA per il medico competente (Enrico, 21/9, strada 1) ────────
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
