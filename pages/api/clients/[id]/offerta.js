// POST /api/clients/[id]/offerta — validità dell'offerta (punto 8 del funnel)
//   { azione: 'inviata', scade_il }  → "Invia offerta via email": Offerta aperta (solo in
//                                      avanti) con la scadenza scelta (null = senza scadenza)
//   { azione: 'sollecitata' }        → promemoria a metà validità fatto (dashboard)
import { requireAuth } from '../../../../lib/auth';
import { isYmd, oggiRoma } from '../../../../lib/checkup';
import { registraOffertaInviata, aggiornaClienteTollerante } from '../../../../lib/pipeline-server';
import { datiOffertaDaCheckup } from '../../../../lib/offerta-server';
import { STATI } from '../../../../lib/forbice.mjs';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;
  const b = req.body || {};
  try {
    if (b.azione === 'inviata') {
      const scade = b.scade_il || null;
      if (scade !== null && (!isYmd(String(scade)) || scade < oggiRoma())) {
        return res.status(422).json({ error: 'La scadenza dell\'offerta deve essere oggi o un giorno futuro.' });
      }

      // ── IL MASSIMO PROMESSO È IL MASSIMO ──────────────────────────────────
      // Il gate sta QUI, sul pulsante che emette l'offerta, non sulla vista: un
      // blocco aggirabile senza accorgersene è peggio di nessun blocco. Il prezzo
      // si RICALCOLA lato server con gli stessi override usati nel documento
      // (n/l1/l2 dall'indirizzo della pagina), così si valuta esattamente ciò che
      // sta per essere inviato — e la forzatura dall'URL non scavalca il tetto.
      if (b.assessment_id) {
        const d = await datiOffertaDaCheckup({
          assessmentId: b.assessment_id,
          n: b.n, l1: b.l1, l2: b.l2,
        }).catch(() => null);
        const t = d && d.tetto;
        if (t && t.stato === STATI.CAPATO) {
          const motivo = (b.sforamento_motivo || '').trim();
          if (motivo.length < 15) {
            return res.status(409).json({
              error: 'Questa offerta supera il massimo della forbice promessa nella Stima.',
              richiede_conferma: true,
              calcolato: t.calcolato, massimo: t.max, scostamento: t.scostamento,
            });
          }
          // Conferma consapevole: si registra PRIMA di emettere, con i due importi.
          const { data: salvato } = await aggiornaClienteTollerante(id, {
            sforamento_forbice_motivo: motivo,
            sforamento_forbice_at: new Date().toISOString(),
            sforamento_forbice_calcolato: Math.round(t.calcolato),
            sforamento_forbice_applicato: Math.round(t.calcolato),
          }).catch(() => ({ data: null }));
          if (!salvato) {
            return res.status(409).json({
              error: 'Serve la migration v63 (tetto della forbice): applicala in Supabase e riprova. Senza, la motivazione dello sforamento non verrebbe registrata.',
              migration_mancante: 'v63',
            });
          }
        }
      }

      const r = await registraOffertaInviata(id, scade);
      if (!r.trovata) return res.status(404).json({ error: 'Azienda non trovata' });
      return res.json(r);
    }
    if (b.azione === 'sollecitata') {
      const { v55Mancante } = await aggiornaClienteTollerante(id, { offerta_sollecito_at: new Date().toISOString() });
      if (v55Mancante) return res.status(409).json({ error: 'Serve la migration v55 (promemoria dell\'offerta): applicala in Supabase e riprova.' });
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'azione non valida' });
  } catch (e) {
    if (e && e.code === 'PGRST116') return res.status(404).json({ error: 'Azienda non trovata' });
    return res.status(500).json({ error: e.message });
  }
});
