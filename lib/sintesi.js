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

export function buildSintesiHtml(d) {
  const v = d.vista || {};
  const partecipazione = d.dipendenti ? `${d.checkup.risposte} su ${d.dipendenti} dipendenti (${Math.round((d.checkup.risposte / d.dipendenti) * 100)}%)` : `${d.checkup.risposte} dipendenti`;
  const livelli = v.pubblicabile && v.livelli ? v.livelli.map(c => {
    const m = LIVELLI[c.key];
    const azione = c.key === 'l2' && d.nuovoProgramma ? 'prevenzione dal primo anno' : m.azione;
    return `<div class="liv" style="background:${m.bg};border-color:${m.color}"><div class="lv-n" style="color:${m.color}">${c.suppressed ? 'n.d.' : `${c.pct}%`}</div><div class="lv-t">${m.nome}</div><div class="lv-d">${m.desc} — ${azione}</div></div>`;
  }).join('') : '';
  const zone = v.zoneTop && v.zoneTop.length ? v.zoneTop.map(z => `${esc(z.zone)} ${z.pct12}%`).join(' · ') : '';
  const p = d.prezzo;
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><style>
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
  .inv { background: #16a34a; color: #fff; border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .inv .eur { font-size: 26px; font-weight: 800; } .inv .sub { font-size: 11px; opacity: .95; }
  .y2 { font-size: 11px; color: #334155; margin-top: 6px; }
  .next { background: #f8fafc; border-left: 4px solid #16a34a; padding: 10px 14px; border-radius: 0 10px 10px 0; }
  .foot { margin-top: 18px; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .muted { color: #64748b; font-size: 11px; }
</style></head><body>
  <div class="top">
    <div><div class="brand">ES <span>Work</span></div><div class="muted">by Essentia Salutis</div></div>
    <div class="tit"><div class="k">Sintesi — Report di Attivazione</div><div class="v">${esc(d.azienda)}</div><div class="muted">${esc(d.data)}</div></div>
  </div>

  <h2>La fotografia</h2>
  ${v.pubblicabile
    ? `<div class="big">${partecipazione} hanno compilato il check-up.</div>${zone ? `<div>Zone più colpite negli ultimi 12 mesi: ${zone}.</div>` : ''}${v.prevalenza != null ? `<div class="muted">Il ${v.prevalenza}% riporta almeno un disturbo negli ultimi 12 mesi.</div>` : ''}`
    : `<div>Risultati aggregati non pubblicabili: meno di 5 risposte. A tutela della riservatezza i risultati si mostrano solo con almeno 5 risposte.</div>`}

  ${livelli ? `<h2>La stratificazione</h2><div class="grid3">${livelli}</div>` : ''}

  <h2>Il vostro programma nel primo anno</h2>
  ${d.quantita && d.quantita.length ? `<ul>${d.quantita.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : `<div>${d.voci.map(esc).join(' · ')}</div>`}

  ${p ? `<h2>L'investimento</h2>
  <div class="inv"><div><div class="sub">Anno 1 — programma completo</div><div class="eur">${eur(p.y1)}</div></div><div class="sub" style="text-align:right">${eur(p.mese)} al mese<br>${eur(p.dipendente)} per dipendente</div></div>
  <div class="y2">Anno 2 e successivi (indicativo): <strong>${eur(p.y2)}</strong> l'anno.${d.inRange && d.forchetta ? ` Dentro la forbice della Stima di investimento presentata al colloquio (${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}).` : ''}</div>` : ''}

  <h2>Il prossimo passo</h2>
  <div class="next">${d.firmato ? 'Avvio del programma in sede secondo il calendario concordato.' : 'Firma del contratto e avvio del programma.'}</div>

  <div class="foot">Dati del check-up in forma aggregata e riservata: i gruppi con meno di 5 persone non sono mostrati. · Essentia Salutis · ES Work · Tel 327 102 7443 · info@essentiasalutis.it</div>
</body></html>`;
}
