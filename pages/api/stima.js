// POST /api/stima — genera la STIMA (pre-assessment) da una sorgente unica.
// I numeri arrivano SEMPRE da computeForchetta(); buildQuoteHtml è l'unico layout
// (usato sia per l'anteprima/stampa nella pagina, sia per il PDF server).
//   body: { clientId?, name, contact_name, sector, employees, tier, groups,
//           vatExempt, rates, l2Mult, store }
//   store=true → genera e salva il PDF (Vercel Blob) e ritorna { url, html }
//   altrimenti → ritorna { html } per anteprima/stampa
import { requireAuth } from '../../lib/auth';
import { generateAndStorePdf, buildQuoteHtml } from '../../lib/pdf';
import { computeForchetta } from '../../lib/calculator';
import { getClientById } from '../../lib/store';

export const config = { maxDuration: 60 };

const SECTOR_LABELS = {
  services: 'Servizi / Uffici',
  manufacturing: 'Manifattura / Produzione',
  mix: 'Mix produzione / uffici',
};

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  const employees = parseInt(b.employees) || 0;
  const sector = b.sector || 'services';

  // Versione listino SEMPRE risolta server-side dal record cliente (mai dal
  // body/query). Prospect senza record → 'v2' (le nuove aziende nascono v2);
  // cliente esistente senza colonna/valore → fail-safe 'v1'.
  let pricingVersion = 'v2';
  if (b.clientId) {
    const client = await getClientById(b.clientId).catch(() => null);
    pricingVersion = client?.pricing_version || 'v1';
  }

  // Sorgente UNICA della forbice.
  const forchetta = computeForchetta({
    n: employees, sector, tier: b.tier, groups: b.groups,
    rates: b.rates, vatExempt: b.vatExempt, l2Mult: b.l2Mult, pricingVersion,
  });

  const html = buildQuoteHtml({
    client: { name: b.name || '—', employees: employees || '—', contact_name: b.contact_name || null },
    forchetta,
    sector_label: SECTOR_LABELS[sector] || '—',
  });

  if (!b.store) return res.json({ ok: true, html });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.json({ ok: true, html, url: null, message: 'Storage PDF non configurato — usa Stampa per salvare in PDF' });
  }
  try {
    const filename = `stima_${b.clientId || 'x'}_${Date.now()}.pdf`;
    const { url } = await generateAndStorePdf(html, filename, 'quotes');
    return res.json({ ok: true, url, html });
  } catch (e) {
    console.error('[stima]', e.message);
    return res.json({ ok: true, html, url: null, error: `PDF non generato: ${e.message}` });
  }
});
