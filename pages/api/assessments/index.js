import { getCheckupCorrente, scriviAssessmentTollerante } from '../../../lib/checkup-server';
import { isYmd, oggiRoma, aggiungiGiorni } from '../../../lib/checkup';
import { getOrgParams } from '../../../lib/org';
import { requireAuth } from '../../../lib/auth';
import { avanzaPipeline } from '../../../lib/pipeline-server';
import {
  getClientById,
  shareCodeExists,
  generateId,
  generateShareCode,
} from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { client_id, type, chiude_il } = req.body;
  if (!client_id || !type) return res.status(400).json({ error: 'Dati mancanti' });
  if (chiude_il !== undefined && chiude_il !== null && (!isYmd(chiude_il) || chiude_il < oggiRoma())) {
    return res.status(422).json({ error: 'La data di chiusura deve essere oggi o un giorno futuro.' });
  }

  try {
    const client = await getClientById(client_id);
    if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

    // Un solo check-up aperto per azienda: prima si chiude il precedente.
    const corrente = await getCheckupCorrente(client_id);
    if (corrente && corrente.status === 'active') {
      return res.status(409).json({ error: 'C\'è già un check-up aperto per questa azienda: chiudilo prima di avviarne un altro.' });
    }

    let share_code;
    do {
      share_code = generateShareCode();
    } while (await shareCodeExists(share_code));

    // v4: strumento unico NMQ. PSS-10/UWES-9/eNPS rimossi dal modello.
    const giorni = (await getOrgParams()).checkupGiorni;
    const { data: assessment, v51Mancante } = await scriviAssessmentTollerante('insert', {
      id: generateId('a'),
      client_id,
      type,
      status: 'active',
      share_code,
      created_at: new Date().toISOString(),
      chiude_il: chiude_il || aggiungiGiorni(oggiRoma(), giorni),
    });

    // Check-up avviato → pipeline "Check-up inviato" (solo in avanti).
    await avanzaPipeline(client_id, 'assessment_sent');
    return res.status(201).json({ ...assessment, ...(v51Mancante ? { avviso: 'Scadenza non salvata: manca la migration v51.' } : {}) });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
