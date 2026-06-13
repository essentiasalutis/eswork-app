// ReportDoc — impaginazione curata dei report ES Work (Attivazione / T3 / T6 / T12).
// Parsifica il markdown (titoli, paragrafi, liste, GRASSETTO inline e TABELLE) e
// lo rende con banner, sezioni accentate e tabelle KPI trasformate in stat-card.
// Esporta anche reportPrintHtml() per la stampa/PDF con la stessa grafica.

// ── parsing markdown → blocchi ───────────────────────────────────────────────
export function parseReport(md) {
  const lines = (md || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes('-');
  const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  while (i < lines.length) {
    const line = lines[i];

    // tabella
    if (isTableRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i]) && !isSep(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (line.startsWith('## ')) { blocks.push({ type: 'h2', text: line.slice(3).trim() }); i++; continue; }
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', text: line.slice(4).trim() }); i++; continue; }
    if (line.startsWith('# ')) { blocks.push({ type: 'h2', text: line.slice(2).trim() }); i++; continue; }

    // liste (raggruppa righe consecutive)
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (line.trim() === '') { i++; continue; }
    blocks.push({ type: 'p', text: line.trim() });
    i++;
  }
  return blocks;
}

// grassetto inline **...**
function inline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(s => s !== '');
  return parts.map((p, k) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={k} className="font-bold text-gray-900">{p.slice(2, -2)}</strong>
      : <span key={k}>{p}</span>
  );
}

// accento/icona per sezione in base al titolo
function sectionStyle(title) {
  const t = (title || '').toLowerCase();
  if (/(kpi|risultat)/.test(t)) return { icon: '📊', bar: '#4f46e5', tint: '#eef2ff' };
  if (/(sintesi|highlight|executive|summary)/.test(t)) return { icon: '⭐', bar: '#d97706', tint: '#fffbeb' };
  if (/(confronto|prima|dopo)/.test(t)) return { icon: '🔄', bar: '#0d9488', tint: '#f0fdfa' };
  if (/(ot23|inail|documentazione)/.test(t)) return { icon: '📋', bar: '#475569', tint: '#f8fafc' };
  if (/(raccomandazion|prossim|passi|anno 2)/.test(t)) return { icon: '✅', bar: '#16a34a', tint: '#f0fdf4' };
  if (/(trend|analis|andament)/.test(t)) return { icon: '📈', bar: '#2563eb', tint: '#eff6ff' };
  if (/(problemat|critic|emerse)/.test(t)) return { icon: '⚠️', bar: '#ea580c', tint: '#fff7ed' };
  if (/(piano|operativ)/.test(t)) return { icon: '🗺️', bar: '#7c3aed', tint: '#f5f3ff' };
  if (/(mappa|popolazione|clinic)/.test(t)) return { icon: '🩺', bar: '#0891b2', tint: '#ecfeff' };
  if (/(propost|economic|investiment)/.test(t)) return { icon: '💶', bar: '#0f766e', tint: '#f0fdfa' };
  return { icon: '▸', bar: '#94a3b8', tint: '#f8fafc' };
}

// una tabella a 2 colonne con intestazione "...|Valore" → stat-card
function isKpiTable(tb) {
  if (!tb || tb.header.length !== 2) return false;
  return /valore|value|risultato/i.test(tb.header[1] || '');
}

// evidenzia il "numero" dentro un valore KPI
function valueClass(v) {
  const s = String(v);
  if (/[−-]\s*\d|%|→/.test(s)) return 'text-indigo-700';
  return 'text-gray-900';
}

function badgeFromTitle(title) {
  const t = (title || '').toLowerCase();
  if (/annuale|12/.test(t)) return { label: 'T12 · Annuale', color: '#7c3aed' };
  if (/t6|6 mes/.test(t)) return { label: 'T6 · 6 mesi', color: '#2563eb' };
  if (/t3|3 mes/.test(t)) return { label: 'T3 · 3 mesi', color: '#0891b2' };
  if (/attivazion/.test(t)) return { label: 'Attivazione', color: '#16a34a' };
  return { label: 'Report', color: '#4f46e5' };
}

// ── componente React ─────────────────────────────────────────────────────────
export default function ReportDoc({ content, title, company, dateStr, source }) {
  const blocks = parseReport(content);
  const badge = badgeFromTitle(title);
  const srcLabel = source === 'ai' ? '✨ Claude AI' : source === 'salvato' ? '📂 Salvato' : '📋 Template';

  // raggruppa: ogni h2 apre una sezione che contiene i blocchi successivi
  const sections = [];
  let cur = null;
  for (const b of blocks) {
    if (b.type === 'h2') { cur = { title: b.text, blocks: [] }; sections.push(cur); }
    else if (cur) cur.blocks.push(b);
    else { cur = { title: null, blocks: [b] }; sections.push(cur); }
  }

  return (
    <div className="text-[15px]">
      {/* Banner */}
      <div className="rounded-2xl px-6 py-5 mb-5 text-white shadow-sm"
        style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#2563eb 60%,#0891b2 100%)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-bold tracking-[0.18em] opacity-90">ES WORK · ESSENTIA SALUTIS</div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">{badge.label}</span>
        </div>
        <div className="text-2xl font-extrabold mt-2 leading-tight">{title}</div>
        <div className="text-sm opacity-90 mt-1">
          {company}{dateStr ? ` · ${dateStr}` : ''} · {srcLabel}
        </div>
      </div>

      {/* Sezioni */}
      <div className="space-y-4">
        {sections.map((s, si) => {
          const st = s.title ? sectionStyle(s.title) : null;
          return (
            <section key={si} className="rounded-2xl border border-gray-200 overflow-hidden">
              {s.title && (
                <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: st.tint, borderLeft: `4px solid ${st.bar}` }}>
                  <span className="text-lg leading-none">{st.icon}</span>
                  <h2 className="font-bold text-gray-900 text-[15px] tracking-tight">{s.title}</h2>
                </div>
              )}
              <div className="px-4 py-3 space-y-3">
                {s.blocks.map((b, bi) => <Block key={bi} b={b} accent={st?.bar} />)}
              </div>
            </section>
          );
        })}
      </div>

      <div className="text-center text-[11px] text-gray-400 mt-6 pt-4 border-t border-gray-100">
        ES Work · Essentia Salutis — documento riservato per {company}
      </div>
    </div>
  );
}

function Block({ b, accent }) {
  if (b.type === 'h3') return <h3 className="font-bold text-gray-800 text-sm mt-1">{inline(b.text)}</h3>;
  if (b.type === 'p') return <p className="text-gray-700 leading-relaxed">{inline(b.text)}</p>;

  if (b.type === 'ul') return (
    <ul className="space-y-1.5">
      {b.items.map((it, k) => (
        <li key={k} className="flex gap-2 text-gray-700 leading-relaxed">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accent || '#94a3b8' }} />
          <span>{inline(it)}</span>
        </li>
      ))}
    </ul>
  );

  if (b.type === 'ol') return (
    <ol className="space-y-1.5">
      {b.items.map((it, k) => (
        <li key={k} className="flex gap-2.5 text-gray-700 leading-relaxed">
          <span className="flex-shrink-0 w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center mt-0.5"
            style={{ background: accent || '#4f46e5' }}>{k + 1}</span>
          <span>{inline(it)}</span>
        </li>
      ))}
    </ol>
  );

  if (b.type === 'table') {
    if (isKpiTable(b)) {
      return (
        <div className="grid sm:grid-cols-3 gap-3">
          {b.rows.map((r, k) => (
            <div key={k} className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-snug">{r[0]}</div>
              <div className={`text-xl font-extrabold mt-1.5 ${valueClass(r[1])}`}>{inline(r[1])}</div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {b.header.map((h, k) => (
                <th key={k} className={`px-3 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wide ${k === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, k) => (
              <tr key={k} className="border-t border-gray-100">
                {r.map((c, ci) => (
                  <td key={ci} className={`px-3 py-2 ${ci === 0 ? 'text-left text-gray-700 font-medium' : 'text-right text-gray-900 font-semibold'}`}>{inline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

// ── HTML per stampa / salva-PDF (stessa grafica, standalone) ─────────────────
export function reportPrintHtml({ title, company, content, dateStr, source }) {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inlineHtml = t => esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const blocks = parseReport(content);
  const badge = badgeFromTitle(title);

  const sectionMeta = (titleStr) => {
    const t = (titleStr || '').toLowerCase();
    if (/(kpi|risultat)/.test(t)) return ['📊', '#4f46e5', '#eef2ff'];
    if (/(sintesi|highlight|executive|summary)/.test(t)) return ['⭐', '#d97706', '#fffbeb'];
    if (/(confronto|prima|dopo)/.test(t)) return ['🔄', '#0d9488', '#f0fdfa'];
    if (/(ot23|inail|documentazione)/.test(t)) return ['📋', '#475569', '#f8fafc'];
    if (/(raccomandazion|prossim|passi|anno 2)/.test(t)) return ['✅', '#16a34a', '#f0fdf4'];
    if (/(trend|analis|andament)/.test(t)) return ['📈', '#2563eb', '#eff6ff'];
    if (/(problemat|critic|emerse)/.test(t)) return ['⚠️', '#ea580c', '#fff7ed'];
    if (/(piano|operativ)/.test(t)) return ['🗺️', '#7c3aed', '#f5f3ff'];
    if (/(mappa|popolazione|clinic)/.test(t)) return ['🩺', '#0891b2', '#ecfeff'];
    if (/(propost|economic|investiment)/.test(t)) return ['💶', '#0f766e', '#f0fdfa'];
    return ['▸', '#94a3b8', '#f8fafc'];
  };
  const isKpi = (tb) => tb.header.length === 2 && /valore|value|risultato/i.test(tb.header[1] || '');

  const renderBlocks = (bs, accent) => bs.map(b => {
    if (b.type === 'h3') return `<h3>${inlineHtml(b.text)}</h3>`;
    if (b.type === 'p') return `<p>${inlineHtml(b.text)}</p>`;
    if (b.type === 'ul') return `<ul>${b.items.map(it => `<li>${inlineHtml(it)}</li>`).join('')}</ul>`;
    if (b.type === 'ol') return `<ol>${b.items.map(it => `<li>${inlineHtml(it)}</li>`).join('')}</ol>`;
    if (b.type === 'table') {
      if (isKpi(b)) {
        return `<div class="kpi">${b.rows.map(r => `<div class="kpicard"><div class="kpil">${inlineHtml(r[0])}</div><div class="kpiv">${inlineHtml(r[1])}</div></div>`).join('')}</div>`;
      }
      return `<table><thead><tr>${b.header.map((h, k) => `<th class="${k === 0 ? 'l' : 'r'}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, ci) => `<td class="${ci === 0 ? 'l' : 'r'}">${inlineHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    return '';
  }).join('\n');

  // raggruppa in sezioni
  let html = '', cur = null, buf = [];
  const flush = () => {
    if (!cur && buf.length) { html += `<div class="sec"><div class="secbody">${renderBlocks(buf, '#94a3b8')}</div></div>`; buf = []; return; }
    if (cur) {
      const [icon, bar, tint] = sectionMeta(cur);
      html += `<div class="sec"><div class="sechead" style="background:${tint};border-left:4px solid ${bar}"><span>${icon}</span><h2>${esc(cur)}</h2></div><div class="secbody">${renderBlocks(buf, bar)}</div></div>`;
      buf = [];
    }
  };
  for (const b of blocks) {
    if (b.type === 'h2') { flush(); cur = b.text; }
    else buf.push(b);
  }
  flush();

  const srcLabel = source === 'ai' ? 'Claude AI' : source === 'salvato' ? 'Salvato' : 'Template';
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:780px;margin:0 auto;padding:28px 28px 48px;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .banner{border-radius:16px;padding:22px 24px;color:#fff;background:linear-gradient(135deg,#4f46e5,#2563eb 60%,#0891b2);margin-bottom:18px}
  .banner .top{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;letter-spacing:.18em;opacity:.92}
  .banner .badge{background:rgba(255,255,255,.2);padding:4px 10px;border-radius:999px;letter-spacing:.04em}
  .banner h1{font-size:24px;margin:8px 0 4px}
  .banner .sub{font-size:13px;opacity:.92}
  .sec{border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;margin-bottom:14px;page-break-inside:avoid}
  .sechead{display:flex;align-items:center;gap:9px;padding:11px 16px}
  .sechead h2{font-size:15px;margin:0;color:#0f172a}
  .secbody{padding:12px 16px}
  p{line-height:1.6;margin:8px 0;color:#334155}
  h3{font-size:14px;margin:10px 0 4px;color:#1e293b}
  ul,ol{margin:8px 0;padding-left:22px}li{margin:4px 0;line-height:1.55;color:#334155}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
  th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;padding:8px 12px}
  td{padding:8px 12px;border-top:1px solid #f1f5f9}
  th.l,td.l{text-align:left}th.r,td.r{text-align:right;font-weight:600;color:#0f172a}
  td.l{color:#475569;font-weight:500}
  .kpi{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:6px 0}
  .kpicard{border:1px solid #e5e7eb;background:#f8fafc;border-radius:12px;padding:12px}
  .kpil{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;font-weight:600;line-height:1.3}
  .kpiv{font-size:20px;font-weight:800;color:#4338ca;margin-top:6px}
  .foot{text-align:center;font-size:11px;color:#94a3b8;margin-top:22px;border-top:1px solid #eef2f7;padding-top:12px}
  @media print{body{padding:0 8px}.banner{border-radius:12px}}
</style></head><body>
<div class="banner"><div class="top"><span>ES WORK · ESSENTIA SALUTIS</span><span class="badge">${esc(badge.label)}</span></div>
<h1>${esc(title)}</h1><div class="sub">${esc(company)}${dateStr ? ' · ' + esc(dateStr) : ''} · ${srcLabel}</div></div>
${html}
<div class="foot">ES Work · Essentia Salutis — documento riservato per ${esc(company)}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script>
</body></html>`;
}
