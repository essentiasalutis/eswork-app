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

export function buildQuoteHtml({ client, scenarios, tier, sector_label }) {
  const now = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
  const tierLabel = tier === 'enterprise' ? 'Enterprise' : tier === 'plus' ? 'Plus' : 'Core';
  const { min, med, max } = scenarios || {};

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #2C3E50; background: #fff; }
  .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 0; }
  .cover-header { background: #2C3E50; color: #fff; padding: 40px 48px 32px; }
  .cover-header .brand { font-size: 32px; font-weight: 800; }
  .cover-header .brand span { color: #16a34a; }
  .cover-header .tagline { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .cover-body { padding: 48px; flex: 1; }
  .cover-body h1 { font-size: 28px; color: #2C3E50; margin-bottom: 8px; }
  .cover-body .subtitle { font-size: 16px; color: #64748b; margin-bottom: 40px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 40px; }
  .meta-item { background: #f8fafc; border-radius: 10px; padding: 16px 20px; }
  .meta-item .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px; }
  .meta-item .value { font-size: 16px; font-weight: 700; color: #2C3E50; }
  .section { margin: 32px 0; }
  .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #16a34a; margin-bottom: 16px; border-bottom: 2px solid #16a34a; padding-bottom: 8px; }
  .scenario-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .scenario-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; text-align: center; }
  .scenario-card.med { border-color: #16a34a; background: #f0fdf4; }
  .scenario-card .s-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
  .scenario-card .s-l1 { font-size: 13px; color: #475569; margin-bottom: 12px; }
  .scenario-card .s-price { font-size: 24px; font-weight: 800; color: #16a34a; }
  .scenario-card .s-detail { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  .note-box { background: #f8fafc; border-left: 4px solid #16a34a; padding: 16px 20px; font-size: 13px; color: #475569; line-height: 1.6; }
  .cover-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 48px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
  .badge { display: inline-block; background: #2C3E50; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-left: 8px; }
  @media print { .cover { page-break-after: always; } }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-header">
    <div class="brand">ES<span> Work</span></div>
    <div class="tagline">by Essentia Salutis</div>
  </div>

  <div class="cover-body">
    <h1>Stima investimento</h1>
    <p class="subtitle">Programma ES Work — Anno 1</p>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="label">Azienda</div>
        <div class="value">${client.name || '—'}</div>
      </div>
      <div class="meta-item">
        <div class="label">Settore</div>
        <div class="value">${sector_label || '—'}</div>
      </div>
      <div class="meta-item">
        <div class="label">Dipendenti</div>
        <div class="value">${client.employees || '—'}</div>
      </div>
      <div class="meta-item">
        <div class="label">Tier</div>
        <div class="value">${tierLabel} <span class="badge">${tierLabel.toUpperCase()}</span></div>
      </div>
      ${client.contact_name ? `<div class="meta-item"><div class="label">Referente</div><div class="value">${client.contact_name}</div></div>` : ''}
      <div class="meta-item">
        <div class="label">Data stima</div>
        <div class="value">${now}</div>
      </div>
    </div>

    <div class="section">
      <h2>Range investimento Anno 1</h2>
      <div class="scenario-grid">
        <div class="scenario-card">
          <div class="s-label">🏷 Ottimistico</div>
          <div class="s-l1">L1: ${min?.l1 || '—'} dipendenti</div>
          <div class="s-price">€${min ? Math.round(min.price_y1).toLocaleString('it-IT') : '—'}</div>
          <div class="s-detail">IVA esente (art. 10 DPR 633/72)</div>
        </div>
        <div class="scenario-card med">
          <div class="s-label">📊 Scenario medio</div>
          <div class="s-l1">L1: ${med?.l1 || '—'} dipendenti</div>
          <div class="s-price">€${med ? Math.round(med.price_y1).toLocaleString('it-IT') : '—'}</div>
          <div class="s-detail">IVA esente (art. 10 DPR 633/72)</div>
        </div>
        <div class="scenario-card">
          <div class="s-label">📈 Conservativo</div>
          <div class="s-l1">L1: ${max?.l1 || '—'} dipendenti</div>
          <div class="s-price">€${max ? Math.round(max.price_y1).toLocaleString('it-IT') : '—'}</div>
          <div class="s-detail">IVA esente (art. 10 DPR 633/72)</div>
        </div>
      </div>
    </div>

    <div class="note-box">
      <strong>Note:</strong> I valori sono stime basate sui dati forniti e sulle prevalenze del settore.
      Il valore finale verrà definito dopo il completamento degli assessment e la stratificazione del personale.
      Operazione esente IVA ai sensi dell'art. 10, n. 18, DPR 633/72.
    </div>
  </div>

  <div class="cover-footer">
    <span>Essentia Salutis · info@essentiasalutis.it</span>
    <span>Documento riservato — non destinato a terzi</span>
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
