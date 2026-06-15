// lib/pdf.js — Generazione PDF con Puppeteer + Vercel Blob
// Richiede env: BLOB_READ_WRITE_TOKEN

/**
 * Genera un PDF da HTML e lo salva su Vercel Blob.
 * @param {string} html - HTML completo del documento
 * @param {string} filename - nome file senza path (es. "quote_abc_2024.pdf")
 * @param {string} folder - cartella in blob (es. "quotes" o "reports")
 * @returns {Promise<{url: string, size: number}>}
 */
export async function generateAndStorePdf(html, filename, folder = 'reports') {
  // Genera PDF
  const pdfBuffer = await generatePdfBuffer(html);

  // Salva su Vercel Blob
  const url = await uploadToBlob(pdfBuffer, `${folder}/${filename}`);

  return { url, size: pdfBuffer.length };
}

/**
 * Genera il buffer PDF da HTML usando Puppeteer.
 */
export async function generatePdfBuffer(html) {
  // Usa puppeteer-core + @sparticuz/chromium-min su Vercel
  // Localmente usa puppeteer normale se disponibile
  let browser;

  try {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      // Ambiente serverless: usa chromium-min
      const chromium = (await import('@sparticuz/chromium-min')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(
          'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar'
        ),
        headless: chromium.headless,
      });
    } else {
      // Locale: prova puppeteer-core con sistema chrome
      const puppeteer = (await import('puppeteer-core')).default;
      const executablePath = process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : '/usr/bin/chromium-browser';

      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath,
        headless: true,
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });

    return pdf;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Carica un buffer su Vercel Blob e restituisce l'URL pubblico.
 */
async function uploadToBlob(buffer, path) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN non configurata');
  }

  const { put } = await import('@vercel/blob');
  const blob = await put(path, buffer, {
    access: 'public',
    contentType: 'application/pdf',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return blob.url;
}

// ─── Template HTML preventivo ─────────────────────────────────────────────────

// Documento STIMA (cliente-facing, pre-assessment). Forbice min/medio/max da
// computeForchetta() — i numeri arrivano sempre da lì. Layout allineato all'Art. 3
// della Lettera di incarico ("Scenario minimo/medio/massimo", "€ / anno", clausola
// di adeguamento asimmetrica). Nessuna tariffa unitaria, margine o dettaglio di calcolo.
export function buildQuoteHtml({ client, forchetta, sector_label }) {
  const now = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
  const f = forchetta || {};
  const min = f.min || {}, avg = f.avg || {}, max = f.max || {};
  const eur = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
  const pct = (s) => Math.round((s && s.pct ? s.pct : 0) * 100);
  const c = client || {};

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #2C3E50; background: #fff; font-size: 13px; line-height: 1.5; }
  .page { max-width: 840px; margin: 0 auto; }
  .header { background: #2C3E50; color: #fff; padding: 32px 40px 26px; }
  .header .brand { font-size: 30px; font-weight: 800; }
  .header .brand span { color: #16a34a; }
  .header .tagline { font-size: 12px; color: #94a3b8; margin-top: 2px; }
  .body { padding: 36px 40px 8px; }
  h1 { font-size: 26px; color: #2C3E50; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #64748b; margin-bottom: 26px; }
  .meta { display: flex; flex-wrap: wrap; gap: 12px 30px; margin-bottom: 28px; padding-bottom: 22px; border-bottom: 1px solid #e2e8f0; }
  .meta .k { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  .meta .v { font-size: 15px; font-weight: 700; color: #2C3E50; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; color: #16a34a; margin: 28px 0 14px; padding-bottom: 7px; border-bottom: 2px solid #16a34a; }
  .scen { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 14px; text-align: center; }
  .card.mid { border: 2px solid #16a34a; background: #f0fdf4; }
  .card .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #64748b; font-weight: 700; margin-bottom: 10px; }
  .card .eur { font-size: 27px; font-weight: 800; color: #16a34a; line-height: 1.05; }
  .card .yr { font-size: 11px; color: #94a3b8; margin-top: 3px; }
  .card .ctx { font-size: 11px; color: #475569; margin-top: 12px; }
  .why { background: #f8fafc; border-left: 4px solid #16a34a; border-radius: 0 10px 10px 0; padding: 18px 22px; }
  .why p { margin-bottom: 9px; } .why p:last-child { margin-bottom: 0; }
  .clause { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px 22px; }
  .clause .ttl { font-weight: 800; color: #16a34a; margin-bottom: 6px; font-size: 14px; }
  .steps { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .step { display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .step.now { background: #f0fdf4; border-color: #16a34a; }
  .step .num { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%; background: #16a34a; color: #fff; font-size: 19px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .step .st { font-weight: 800; font-size: 13px; margin-bottom: 3px; }
  .step .sd { font-size: 12px; color: #64748b; line-height: 1.45; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 40px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; margin-top: 30px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .card, .step { break-inside: avoid; } h2 { break-after: avoid; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">ES<span> Work</span></div>
    <div class="tagline">by Essentia Salutis</div>
  </div>

  <div class="body">
    <h1>Stima dell'investimento</h1>
    <p class="subtitle">Programma ES Work — Anno 1 · prevenzione e salute muscolo-scheletrica in azienda</p>

    <div class="meta">
      <div><div class="k">Azienda</div><div class="v">${c.name || '—'}</div></div>
      ${c.contact_name ? `<div><div class="k">Referente</div><div class="v">${c.contact_name}</div></div>` : ''}
      <div><div class="k">Settore</div><div class="v">${sector_label || '—'}</div></div>
      <div><div class="k">Dipendenti</div><div class="v">${c.employees || '—'}</div></div>
      <div><div class="k">Data</div><div class="v">${now}</div></div>
    </div>

    <h2>La forbice dell'investimento — Anno 1</h2>
    <div class="scen">
      <div class="card">
        <div class="lbl">Scenario minimo</div>
        <div class="eur">${eur(min.price_y1)}</div>
        <div class="yr">€ / anno · esente IVA</div>
        <div class="ctx">~${pct(min)}% in Livello 1 · ~${min.l1 || 0} dipendenti</div>
      </div>
      <div class="card mid">
        <div class="lbl">Scenario medio</div>
        <div class="eur">${eur(avg.price_y1)}</div>
        <div class="yr">€ / anno · esente IVA</div>
        <div class="ctx">~${pct(avg)}% in Livello 1 · ~${avg.l1 || 0} dipendenti</div>
      </div>
      <div class="card">
        <div class="lbl">Scenario massimo</div>
        <div class="eur">${eur(max.price_y1)}</div>
        <div class="yr">€ / anno · esente IVA</div>
        <div class="ctx">~${pct(max)}% in Livello 1 · ~${max.l1 || 0} dipendenti</div>
      </div>
    </div>

    <h2>Perché una forbice e non un prezzo fisso</h2>
    <div class="why">
      <p>Il prezzo definitivo del programma dipende dalla <strong>composizione reale della vostra popolazione</strong> — quante persone presentano un effettivo bisogno clinico — ed è un dato che si conosce con certezza <strong>solo dopo l'assessment</strong>.</p>
      <p>La forbice non è un'incertezza commerciale: riflette un metodo clinico rigoroso. Ogni azienda ha la propria fotografia muscolo-scheletrica, e l'investimento si calibra su quella, non su un modello uguale per tutti.</p>
    </div>

    <h2>Come si fissa il prezzo definitivo</h2>
    <div class="clause">
      <div class="ttl">Il prezzo non supera mai il massimo presentato.</div>
      <p>Dopo l'assessment il corrispettivo viene fissato <strong>all'interno di questa forbice</strong>, sulla base dei dati reali. La clausola di adeguamento è <strong>asimmetrica a vostro favore</strong>: se il bisogno reale è inferiore pagate meno; in nessun caso pagate più dello scenario massimo qui indicato. Nessuna sorpresa.</p>
    </div>

    <h2>I prossimi passi</h2>
    <div class="steps">
      <div class="step now">
        <div class="num">1</div>
        <div><div class="st">Colloquio e stima</div><div class="sd">Questo momento. Vi presentiamo il modello e la stima dell'investimento — la forbice qui sopra — calibrata sulla vostra dimensione e sul vostro settore.</div></div>
      </div>
      <div class="step">
        <div class="num">2</div>
        <div><div class="st">Assessment della popolazione</div><div class="sd">Ogni dipendente compila un questionario digitale validato: la fotografia oggettiva dello stato di salute muscolo-scheletrica, in forma aggregata e anonima.</div></div>
      </div>
      <div class="step">
        <div class="num">3</div>
        <div><div class="st">Report di Attivazione e prezzo definitivo</div><div class="sd">Dai dati reali nasce il Report di Attivazione, che fotografa la situazione e fissa il prezzo definitivo del programma, all'interno della forbice già presentata.</div></div>
      </div>
      <div class="step">
        <div class="num">4</div>
        <div><div class="st">Contratto e avvio</div><div class="sd">Si formalizza il contratto al prezzo confermato e parte l'erogazione del programma.</div></div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Essentia Salutis · info@essentiasalutis.it</span>
    <span>Documento riservato — operazione esente IVA (art. 10, n. 18, DPR 633/72)</span>
  </div>
</div>
</body>
</html>`;
}

// ─── Template HTML report AI ──────────────────────────────────────────────────

export function buildReportHtml({ client, report_type, content_text, checkpoint }) {
  const now = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
  const typeLabels = {
    activation: 'Report di Attivazione',
    checkpoint_t3: 'Report Intermedio T3',
    checkpoint_t6: 'Report Intermedio T6',
    annual_t12: 'Report Annuale T12',
  };
  const typeLabel = typeLabels[report_type] || 'Report ES Work';

  // Converti markdown in HTML
  const bodyHtml = markdownToHtml(content_text || '');

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #2C3E50; background: #fff; font-size: 13px; line-height: 1.6; }
  .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .cover-header { background: #2C3E50; color: #fff; padding: 40px 48px 32px; }
  .cover-header .brand { font-size: 32px; font-weight: 800; }
  .cover-header .brand span { color: #16a34a; }
  .cover-body { padding: 48px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-body h1 { font-size: 32px; font-weight: 800; color: #2C3E50; margin-bottom: 8px; }
  .cover-body .type-badge { display: inline-block; background: #16a34a; color: #fff; font-size: 12px; font-weight: 700; padding: 6px 16px; border-radius: 20px; margin-bottom: 32px; }
  .cover-body .client-name { font-size: 20px; color: #475569; margin-bottom: 40px; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cover-meta .item { background: #f8fafc; border-radius: 8px; padding: 12px 16px; }
  .cover-meta .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  .cover-meta .value { font-size: 14px; font-weight: 600; color: #2C3E50; margin-top: 2px; }
  .cover-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 48px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
  .content { padding: 40px 48px; }
  .content h2 { font-size: 18px; color: #16a34a; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #16a34a; }
  .content h3 { font-size: 15px; color: #2C3E50; margin: 20px 0 8px; }
  .content p { margin-bottom: 12px; color: #475569; }
  .content ul, .content ol { padding-left: 20px; margin-bottom: 12px; color: #475569; }
  .content li { margin-bottom: 4px; }
  .content strong { color: #2C3E50; }
  .page-footer { position: fixed; bottom: 15mm; left: 0; right: 0; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .confidential { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 8px 14px; font-size: 11px; color: #92400e; display: inline-block; margin-top: 16px; }
</style>
</head>
<body>

<!-- COPERTINA -->
<div class="cover">
  <div class="cover-header">
    <div class="brand">ES<span> Work</span></div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px;">by Essentia Salutis</div>
  </div>
  <div class="cover-body">
    <div class="type-badge">${typeLabel}</div>
    <h1>${client.name || 'Cliente'}</h1>
    <p class="client-name">${client.sector === 1 ? 'Manifattura / Produzione' : 'Ufficio / IT / Servizi'} · ${client.employees || '—'} dipendenti</p>
    <div class="cover-meta">
      <div class="item"><div class="label">Data report</div><div class="value">${now}</div></div>
      <div class="item"><div class="label">Tipo</div><div class="value">${typeLabel}</div></div>
      ${client.contact_name ? `<div class="item"><div class="label">Referente</div><div class="value">${client.contact_name}</div></div>` : ''}
      <div class="item"><div class="label">Generato da</div><div class="value">ES Work AI</div></div>
    </div>
    <div class="confidential">🔒 Documento riservato — uso esclusivo cliente</div>
  </div>
  <div class="cover-footer">
    <span>Essentia Salutis · info@essentiasalutis.it</span>
    <span>Operazione esente IVA art. 10 DPR 633/72</span>
  </div>
</div>

<!-- CONTENUTO -->
<div class="content">
  ${bodyHtml}
</div>

<div class="page-footer">
  ES Work — ${client.name} — ${typeLabel} — ${now} &nbsp;|&nbsp; Essentia Salutis
</div>

</body>
</html>`;
}

// ─── Markdown → HTML (semplice) ───────────────────────────────────────────────

function markdownToHtml(md) {
  return md
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<p><strong>$1</strong></p>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^(?!<[hul]|<li)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}
