import { requireAuth } from '../../../lib/auth';
import { getProfessionalById, updateProfessional } from '../../../lib/store';
import { hashPassword } from '../../../lib/pro-auth';
import supabase from '../../../lib/db';
import { TABELLE_TRACCE, esitoTracce, messaggioTracce } from '../../../lib/eliminazione-professionista.mjs';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;
  const pro = await getProfessionalById(id);
  if (!pro) return res.status(404).json({ error: 'Non trovato' });

  // Disattiva / riattiva / aggiorna password
  if (req.method === 'PATCH') {
    try {
      const { active, must_reset_password, new_password } = req.body;
      const fields = {};
      if (active !== undefined) fields.active = active;
      if (must_reset_password !== undefined) fields.must_reset_password = must_reset_password;
      if (new_password) {
        if (new_password.length < 8) return res.status(400).json({ error: 'Password min. 8 caratteri' });
        fields.password_hash = hashPassword(new_password);
        fields.must_reset_password = true;
      }
      const updated = await updateProfessional(id, fields);
      // Mai l'hash della password verso il browser, nemmeno dell'amministratore (21/9).
      const { password_hash, ...senzaHash } = updated || {};
      return res.json(senzaHash);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Elimina professionista — solo se non ha lasciato alcuna traccia (Enrico, 21/9).
  // Non si cancella mai nulla di collegato: sedute e registro degli accessi restano.
  // Per chiunque sia entrato almeno una volta c'è solo la disattivazione (PATCH).
  if (req.method === 'DELETE') {
    try {
      const conteggi = {};
      for (const { tabella, colonna } of TABELLE_TRACCE) {
        const { count, error } = await supabase.from(tabella)
          .select(colonna, { count: 'exact', head: true }).eq(colonna, id);
        // Lettura fallita: il conteggio resta vuoto e la regola non elimina.
        if (error) console.error(`[elimina professionista] verifica su ${tabella} non riuscita: ${error.message}`);
        else conteggi[tabella] = count;
      }
      const esito = esitoTracce(conteggi);
      if (!esito.eliminabile) {
        return res.status(409).json({
          codice: 'tracce',
          error: messaggioTracce(esito, { nome: pro.name || 'Il professionista', attivo: !!pro.active }),
          elementi: esito.elementi,
        });
      }
      // Le assegnazioni alle aziende seguono il professionista (ON DELETE CASCADE).
      // Se nel frattempo è entrato, la chiave esterna del registro rifiuta l'eliminazione.
      const { error } = await supabase.from('professionals').delete().eq('id', id);
      if (error) throw error;
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
