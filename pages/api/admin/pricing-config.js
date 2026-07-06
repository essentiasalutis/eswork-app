// GET/PUT /api/admin/pricing-config — configurazione pricing v2 (SOLO admin).
// GET → { params, texts, servizi } : fattori numerici v2, testi (argomentari,
//        naming cliente-facing, testo evoluzione) e tabella servizi_deliverable.
// PUT  → { tipo:'setting', key, value }  aggiorna un parametro/testo v2
//        { tipo:'servizio', id, ...campi } aggiorna una voce servizi (valore,
//        argomentario, attivo) — voce/configurazione restano strutturali.
// La v1 NON è configurabile da qui (congelata nel codice): impossibile toccarla.
import { requireAuth } from '../../../lib/auth';
import { getPricingSettingsV2, updatePricingSettingV2, getServiziDeliverable, updateServizioDeliverable } from '../../../lib/pricing/settings';
import { DEFAULTS_V2 } from '../../../lib/pricing/v2';

export default requireAuth(async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [{ params, texts }, servizi] = await Promise.all([getPricingSettingsV2(), getServiziDeliverable()]);
      return res.json({ params, texts, servizi, defaults: DEFAULTS_V2 });
    }
    if (req.method === 'PUT') {
      const b = req.body || {};
      if (b.tipo === 'setting') {
        if (!b.key) return res.status(400).json({ error: 'key mancante' });
        // I fattori numerici devono restare numeri (mai NaN nel motore).
        if (Object.prototype.hasOwnProperty.call(DEFAULTS_V2, b.key) && !Number.isFinite(Number(b.value))) {
          return res.status(422).json({ error: `"${b.key}" deve essere un numero` });
        }
        await updatePricingSettingV2(b.key, b.value);
        return res.json({ ok: true });
      }
      if (b.tipo === 'servizio') {
        if (!b.id) return res.status(400).json({ error: 'id mancante' });
        if (b.valore_dichiarato !== undefined && !Number.isFinite(Number(b.valore_dichiarato))) {
          return res.status(422).json({ error: 'valore_dichiarato deve essere un numero' });
        }
        const upd = await updateServizioDeliverable(b.id, {
          valore_dichiarato: b.valore_dichiarato !== undefined ? Number(b.valore_dichiarato) : undefined,
          descrizione_argomentario: b.descrizione_argomentario,
          attivo: b.attivo,
          ordine: b.ordine,
        });
        return res.json({ ok: true, servizio: upd });
      }
      return res.status(400).json({ error: 'tipo non valido' });
    }
    return res.status(405).end();
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
