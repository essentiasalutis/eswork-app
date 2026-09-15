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
      // Il prezzo proposto è già capato al massimo della forbice: emettere
      // l'offerta al massimo è il caso NORMALE e non chiede niente a nessuno.
      // Qui si registra solo la TRACCIA dello scostamento — quanto valeva il
      // dimensionamento reale e quanto si è applicato — perché è il dato che
      // serve alla trattativa dell'Anno 2 (Enrico, 15/9).
      // Superare il massimo è un'altra cosa: si autorizza PRIMA, con
      // `azione: 'autorizza_sforamento'`, e resta scritto sulla scheda.
      if (b.assessment_id) {
        const d = await datiOffertaDaCheckup({
          assessmentId: b.assessment_id,
          n: b.n, l1: b.l1, l2: b.l2,
        }).catch(() => null);
        const t = d && d.tetto;
        if (t && (t.stato === STATI.CAPATO || t.stato === STATI.SOPRA_AUTORIZZATO)) {
          await aggiornaClienteTollerante(id, {
            sforamento_forbice_calcolato: Math.round(t.calcolato),
            sforamento_forbice_applicato: Math.round(t.prezzo),
          }).catch(() => null);   // senza la v63 la traccia non si scrive, l'offerta parte lo stesso
        }
      }

      const r = await registraOffertaInviata(id, scade);
      if (!r.trovata) return res.status(404).json({ error: 'Azienda non trovata' });
      return res.json(r);
    }
    // Autorizzazione a superare il massimo promesso: atto esplicito e separato
    // dall'emissione. Senza motivazione scritta non si registra — e senza
    // registrazione il tetto resta applicato.
    if (b.azione === 'autorizza_sforamento') {
      const motivo = (b.motivo || '').trim();
      if (motivo.length < 15) return res.status(422).json({ error: 'Scrivi la motivazione (almeno 15 caratteri): resta agli atti ed è interna.' });
      const { data } = await aggiornaClienteTollerante(id, {
        sforamento_forbice_motivo: motivo,
        sforamento_forbice_at: new Date().toISOString(),
      }).catch(() => ({ data: null }));
      if (!data) {
        return res.status(409).json({
          error: 'Serve la migration v63 (tetto della forbice): applicala in Supabase e riprova. Senza, l\'autorizzazione non verrebbe registrata.',
          migration_mancante: 'v63',
        });
      }
      return res.json({ ok: true, motivo });
    }

    // Revoca dell'autorizzazione: si torna al massimo promesso.
    if (b.azione === 'revoca_sforamento') {
      await aggiornaClienteTollerante(id, { sforamento_forbice_motivo: null, sforamento_forbice_at: null }).catch(() => null);
      return res.json({ ok: true });
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
