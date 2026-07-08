// POST /api/org/[clientId]/invito — genera/revoca l'invito clinico monouso di un
// dipendente (ADMIN only). body { dipendente_id, action:'genera'|'revoca', override? }.
// 'genera' → token IN CHIARO una sola volta (per costruire il link /invito/<token>)
// + flip del flag →'invitato'. L'override è il percorso ECCEZIONALE di recupero-errore
// (crea una nuova cartella clinica scollegata): richiede conferma esplicita lato UI.
import { requireAuth } from '../../../../lib/auth';
import { generaInvitoToken, revocaInvitoToken } from '../../../../lib/org';
import supabase from '../../../../lib/db';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { clientId } = req.query;
  const { dipendente_id, action, override } = req.body || {};
  if (!dipendente_id) return res.status(400).json({ error: 'dipendente_id mancante' });

  // Scoping: il dipendente deve appartenere a QUESTO cliente (difesa applicativa).
  const { data: dip } = await supabase.from('org_dipendente')
    .select('id').eq('id', dipendente_id).eq('client_id', clientId).maybeSingle();
  if (!dip) return res.status(404).json({ error: 'dipendente non trovato in questo cliente' });

  try {
    if (action === 'revoca') {
      await revocaInvitoToken(dipendente_id);
      return res.json({ ok: true });
    }
    const { token } = await generaInvitoToken(dipendente_id, { override: !!override });
    return res.json({ ok: true, token }); // plaintext UNA volta; l'UI costruisce /invito/<token>
  } catch (e) {
    // Guardia: 409 con codice → l'UI chiede conferma esplicita per l'override.
    if (e.code === 'GIA_COMPLETATO' || e.code === 'GIA_CONSUMATO') {
      return res.status(409).json({ error: e.code });
    }
    return res.status(500).json({ error: e.message });
  }
});
