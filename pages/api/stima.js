// POST /api/stima — genera la STIMA (pre-assessment) da una sorgente unica.
// I numeri arrivano SEMPRE da computeForchetta(); buildQuoteHtml è l'unico layout
// (usato sia per l'anteprima/stampa nella pagina, sia per il PDF server).
//   body: { clientId?, name, contact_name, sector, employees, tier, groups,
//           vatExempt, rates, l2Mult, store }
//   store=true → genera e salva il PDF (Vercel Blob) e ritorna { url, html }
//   altrimenti → ritorna { html } per anteprima/stampa
import { requireAuth } from '../../lib/auth';
import { generateAndStorePdf, buildQuoteHtml, buildPacchettoHtml } from '../../lib/pdf';
import { computeForchetta } from '../../lib/calculator';
import { getClientById, getFirstMeeting } from '../../lib/store';
import { getPricingSettingsV2 } from '../../lib/pricing/settings';
import { validatePacchetto, calculatePacchetto } from '../../lib/pricing/v2';
import { buildStimaSnapshot, writeStimaSnapshotIfOpen, isChainClosed, getStimaSnapshot } from '../../lib/pricing/snapshot';

export const config = { maxDuration: 60 };

const SECTOR_LABELS = {
  services: 'Servizi / Uffici',
  manufacturing: 'Manifattura / Produzione',
  mix: 'Mix produzione / uffici',
};

// Snapshot Stima→Report: se v2 con clientId, decide fra CONGELATO (catena chiusa),
// SCRITTURA (store=true, catena aperta) o ANTEPRIMA (store=false). Ritorna i flag
// per la UI e l'eventuale snapshot congelato (per mostrare la forbice promessa).
async function applySnapshot({ clientId, pricingVersion, store, draftBuilder }) {
  if (pricingVersion !== 'v2' || !clientId) return { info: null, frozenSnap: null };
  const existing = getStimaSnapshot(await getFirstMeeting(clientId));
  if (await isChainClosed(clientId)) {
    return { info: { exists: !!existing, frozen: true, source: 'snapshot', at: existing?.at || null }, frozenSnap: existing };
  }
  if (store) {
    const snap = draftBuilder();
    const w = await writeStimaSnapshotIfOpen(clientId, snap);
    return { info: { exists: true, frozen: w.frozen, source: 'snapshot', at: (w.snapshot && w.snapshot.at) || snap.at }, frozenSnap: w.frozen ? w.snapshot : null };
  }
  return { info: { exists: !!existing, frozen: false, source: 'live', preview: true, at: existing?.at || null }, frozenSnap: null };
}

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

  // Parametri v2 (override admin dal DB) + input ergonomia dal colloquio.
  const settingsV2 = pricingVersion === 'v2' ? await getPricingSettingsV2() : null;
  const v2Params = settingsV2 ? settingsV2.params : null;
  const ergonomia = pricingVersion === 'v2'
    ? { nUfficio: b.ergonomiaUfficio != null ? parseInt(b.ergonomiaUfficio) || 0 : undefined, nPostazioni: parseInt(b.ergonomiaPostazioni) || 0 }
    : undefined;

  // Prodotto d'ingresso: REGOLE DURE lato server (la UI può nascondere l'opzione,
  // ma è l'API a rifiutarla: soglia popolazione + solo listino v2).
  if (b.tipoProdotto === 'pacchetto_prevenzione') {
    const check = validatePacchetto({ employees, pricingVersion, v2Params });
    if (!check.ok) return res.status(422).json({ ok: false, error: check.motivo });
    const pacchetto = calculatePacchetto({ n: employees, groups: b.groups, rates: b.rates, vatExempt: b.vatExempt, v2Params, ergonomia });
    const { info: snapshot } = await applySnapshot({
      clientId: b.clientId, pricingVersion, store: b.store,
      draftBuilder: () => buildStimaSnapshot({
        pricingVersion, tipoProdotto: 'pacchetto_prevenzione',
        inputs: { n: employees, sector, groups: b.groups, rates: b.rates, vatExempt: b.vatExempt, ergonomia },
        v2Params, pacchettoPrice: pacchetto?.price, at: new Date().toISOString(),
      }),
    });
    // Template DEDICATO: naming parametrico, nessun trattamento come incluso.
    const pHtml = buildPacchettoHtml({
      client: { name: b.name || '—', employees: employees || '—', contact_name: b.contact_name || null },
      pacchetto,
      naming: settingsV2?.texts?.naming_cliente_pacchetto_prevenzione,
      sector_label: SECTOR_LABELS[sector] || '—',
    });
    if (!b.store) return res.json({ ok: true, pacchetto, html: pHtml, snapshot });
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.json({ ok: true, pacchetto, html: pHtml, url: null, snapshot, message: 'Storage PDF non configurato — usa Stampa per salvare in PDF' });
    try {
      const { url } = await generateAndStorePdf(pHtml, `stima_pacchetto_${b.clientId || 'x'}_${Date.now()}.pdf`, 'quotes');
      return res.json({ ok: true, pacchetto, url, html: pHtml, snapshot });
    } catch (e) {
      return res.json({ ok: true, pacchetto, html: pHtml, url: null, snapshot, error: `PDF non generato: ${e.message}` });
    }
  }

  // Sorgente UNICA della forbice (live).
  const forchetta = computeForchetta({
    n: employees, sector, tier: b.tier, groups: b.groups,
    rates: b.rates, vatExempt: b.vatExempt, l2Mult: b.l2Mult, pricingVersion, v2Params, ergonomia,
  });

  // Snapshot: congelato (catena chiusa) / scritto (store=true) / anteprima.
  const { info: snapshot, frozenSnap } = await applySnapshot({
    clientId: b.clientId, pricingVersion, store: b.store,
    draftBuilder: () => buildStimaSnapshot({
      pricingVersion, tipoProdotto: 'programma_completo',
      inputs: { n: employees, sector, tier: b.tier, groups: b.groups, rates: b.rates, vatExempt: b.vatExempt, l2Mult: b.l2Mult, ergonomia },
      v2Params, forchetta, at: new Date().toISOString(),
    }),
  });
  // Se la catena è chiusa mostriamo la forbice CONGELATA (decisione: nessun ricalcolo).
  const forchettaOut = (frozenSnap && frozenSnap.forchetta) ? frozenSnap.forchetta : forchetta;

  const html = buildQuoteHtml({
    client: { name: b.name || '—', employees: employees || '—', contact_name: b.contact_name || null },
    forchetta: forchettaOut,
    sector_label: SECTOR_LABELS[sector] || '—',
    // Sezione componenti SOLO per v2 (v1 resta byte-identico)
    v2Doc: pricingVersion === 'v2' ? { ergonomiaPostazioni: (ergonomia && ergonomia.nPostazioni) || 0 } : null,
  });

  // `forchetta`+`snapshot` in risposta: solo admin (requireAuth). Servono alla UI
  // colloquio (dettaglio + label "ANTEPRIMA — forbice non impegnata" quando
  // store=false e snapshot NULL); il documento cliente resta le tre cifre.
  if (!b.store) return res.json({ ok: true, html, forchetta: forchettaOut, snapshot });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.json({ ok: true, html, url: null, snapshot, message: 'Storage PDF non configurato — usa Stampa per salvare in PDF' });
  }
  try {
    const filename = `stima_${b.clientId || 'x'}_${Date.now()}.pdf`;
    const { url } = await generateAndStorePdf(html, filename, 'quotes');
    return res.json({ ok: true, url, html, snapshot });
  } catch (e) {
    console.error('[stima]', e.message);
    return res.json({ ok: true, html, url: null, snapshot, error: `PDF non generato: ${e.message}` });
  }
});
