// POST /api/admin/clients/[id]/generate-quote-pdf
// Genera PDF preventivo e lo salva su Vercel Blob
import { requireAuth } from '../../../../../lib/auth';
import { getClientById, insertDocument } from '../../../../../lib/store';
import { generateAndStorePdf, buildQuoteHtml } from '../../../../../lib/pdf';
import { calculatePricing } from '../../../../../lib/calculator';

export const config = { maxDuration: 60 };

const SECTOR_LABELS = { 1: 'Manifattura / Produzione', 2: 'Ufficio / IT / Servizi' };

// Stima L1 per scenario (min/med/max)
function estimateScenarios(employees, sector) {
  const n = parseInt(employees) || 0;
  const base = sector === 1 ? [0.10, 0.17, 0.25] : [0.07, 0.12, 0.18];
  return base.map(pct => {
    const l1 = Math.round(n * pct);
    const l2 = Math.round(l1 * 2.2);
    const calc = calculatePricing(n, l1, l2) || {};
    return { l1, l2, pct, ...calc };
  });
}

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const client = await getClientById(id).catch(() => null);
  if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

  const [minScenario, medScenario, maxScenario] = estimateScenarios(client.employees, client.sector);
  const tier = client.tier || (parseInt(client.employees) <= 150 ? 'core' : parseInt(client.employees) <= 500 ? 'plus' : 'enterprise');

  const html = buildQuoteHtml({
    client,
    scenarios: { min: minScenario, med: medScenario, max: maxScenario },
    tier,
    sector_label: SECTOR_LABELS[client.sector] || 'N.D.',
  });

  // Se BLOB_READ_WRITE_TOKEN non è configurata, restituisce solo HTML
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.json({ ok: true, url: null, html_preview: true, message: 'BLOB_READ_WRITE_TOKEN non configurata — PDF non salvato' });
  }

  try {
    const filename = `quote_${id}_${Date.now()}.pdf`;
    const { url, size } = await generateAndStorePdf(html, filename, 'quotes');

    const doc = await insertDocument({
      client_id: id,
      type: 'quote',
      file_url: url,
      metadata: { employees: client.employees, tier, size, filename },
    }).catch(() => null);

    return res.json({ ok: true, url, doc_id: doc?.id });
  } catch (e) {
    console.error('[generate-quote-pdf]', e.message);
    return res.status(500).json({ error: `Errore generazione PDF: ${e.message}` });
  }
});
