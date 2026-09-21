// /api/admin/medici-competenti — gestione del ruolo (solo amministratore).
//   GET → medici, documenti caricati, relazioni, aziende, stato dell'informativa
//   POST { azione } → crea | disattiva | riattiva | assegna | revoca |
//                     prepara_documento | carica_documento | apri_documento
import { requireAuth } from '../../../../lib/auth';
import { hashPassword } from '../../../../lib/pro-auth';
import supabase from '../../../../lib/db';
import { creaMedico, aggiornaMedico, assegna, revoca, preparaDocumento, accettaDocumento, linkDocumento, informativaPronta } from '../../../../lib/medico-competente-server';
import { DOCUMENTI_MC, PRESIDI } from '../../../../lib/medico-competente.mjs';

export default requireAuth(async function handler(req, res) {
  const admin = req.session.email;
  if (req.method === 'GET') {
    const [{ data: medici }, { data: docs }, { data: rel }, { data: aziende }, pronta] = await Promise.all([
      supabase.from('medici_competenti').select('id, nome, email, attivo, must_reset_password, creato_il, disattivato_il').order('creato_il', { ascending: false }),
      supabase.from('mc_documenti').select('id, medico_id, tipo, data_firma, caricato_il, caricato_da, file_impronta, file_mime').order('caricato_il', { ascending: false }),
      supabase.from('medico_aziende').select('id, medico_id, client_id, dal, revocato_il, assegnato_da, revocato_da').order('dal', { ascending: false }),
      supabase.from('clients').select('id, name, is_demo').order('name'),
      informativaPronta().catch(() => false),
    ]);
    const nomi = Object.fromEntries((aziende || []).map(a => [a.id, a.name]));
    return res.json({
      informativaPronta: pronta, tipiDocumento: DOCUMENTI_MC, presidi: PRESIDI,
      aziende: (aziende || []).map(a => ({ id: a.id, nome: a.name, demo: !!a.is_demo })),
      medici: (medici || []).map(m => ({
        ...m,
        documenti: (docs || []).filter(d => d.medico_id === m.id),
        relazioni: (rel || []).filter(r => r.medico_id === m.id).map(r => ({ ...r, azienda: nomi[r.client_id] || r.client_id })),
      })),
    });
  }
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  try {
    if (b.azione === 'crea') {
      const nome = String(b.nome || '').trim(); const email = String(b.email || '').trim();
      if (nome.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Nome e email validi obbligatori.' });
      if (!b.password || String(b.password).length < 10) return res.status(400).json({ error: 'Password iniziale di almeno 10 caratteri: il medico la cambia al primo accesso.' });
      const m = await creaMedico({ nome, email, passwordHash: hashPassword(String(b.password)) });
      return res.json({ ok: true, medico: m });
    }
    if (b.azione === 'disattiva') { await aggiornaMedico(b.medicoId, { attivo: false, disattivato_il: new Date().toISOString() }); return res.json({ ok: true }); }
    if (b.azione === 'riattiva') { await aggiornaMedico(b.medicoId, { attivo: true, disattivato_il: null }); return res.json({ ok: true }); }
    if (b.azione === 'assegna') {
      const r = await assegna({ medicoId: String(b.medicoId || ''), clientId: String(b.clientId || ''), admin });
      return r.ok ? res.json({ ok: true }) : res.status(409).json({ error: r.errore, mancanti: r.mancanti || [] });
    }
    if (b.azione === 'revoca') { const r = await revoca({ relazioneId: String(b.relazioneId || ''), admin }); return r.ok ? res.json({ ok: true }) : res.status(409).json({ error: r.errore }); }
    if (b.azione === 'prepara_documento') { const r = await preparaDocumento(String(b.medicoId || ''), b.content_type); return r.ok ? res.json(r) : res.status(400).json({ error: r.errore }); }
    if (b.azione === 'carica_documento') {
      const r = await accettaDocumento({ medicoId: String(b.medicoId || ''), path: b.path, tipo: b.tipo, dataFirma: b.data_firma, admin });
      return r.ok ? res.json({ ok: true }) : res.status(400).json({ error: r.errore });
    }
    if (b.azione === 'apri_documento') { const url = await linkDocumento(String(b.documentoId || '')); return url ? res.json({ url }) : res.status(404).json({ error: 'Documento non trovato' }); }
    return res.status(400).json({ error: 'Azione non valida' });
  } catch (e) {
    return res.status(500).json({ error: /duplicate key.*email/i.test(e.message) ? 'Esiste già un medico con questa email.' : e.message });
  }
});
