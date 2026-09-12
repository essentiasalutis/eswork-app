import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../../lib/auth';
import { pianoDeterministico, zoneCritiche, zoneAmmesse } from '../../../lib/piano';

// Piano di intervento con l'AI. Si arriva qui SOLO da un gesto esplicito (il pulsante
// sull'Offerta): l'apertura della pagina non chiama più nulla. Il payload NON è quello
// del browser: il server lo ricostruisce dalla whitelist di lib/piano.js — zone note e
// percentuali, niente nome dell'azienda, niente campi estranei.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const zones = zoneAmmesse(req.body?.zones);
  if (!zones.length) return res.status(400).json({ error: 'Nessuna zona valida.' });
  const sector = Number(req.body?.sector) === 1 ? 1 : 2;
  const n1 = Math.round(Number(req.body?.level1Count));
  const level1Count = Number.isFinite(n1) && n1 > 0 ? n1 : 0;

  // Se manca la chiave API → piano della piattaforma, nessun dato esce
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ plan: pianoDeterministico(zones), source: 'fallback_no_key' });
  }

  const criticalZones = zoneCritiche(zones);
  const zoneText = criticalZones.map(z => `- ${z.zone}: ${z.pct12}%`).join('\n');
  const sectorLabel = sector === 1 ? 'manifattura/produzione' : 'ufficio/servizi';

  const prompt = `Sei un consulente di salute occupazionale. Genera un piano di intervento per un'azienda basandoti su questi dati NMQ:
${zoneText}
Settore: ${sectorLabel}. Dipendenti di Livello 1: ${level1Count}

Genera una tabella JSON con massimo 5 righe, formato:
[{"criticita": "X% disturbi [zona]", "intervento": "descrizione intervento specifico", "risultato": "risultato atteso realistico"}]

Gli interventi devono essere coerenti con il programma ES Work: sportello osteopatico individuale + formazione collettiva. I risultati devono essere realistici (riduzione 20-30%, non eliminazione). Se nessuna zona supera il 30%, genera comunque 1-2 righe con le zone più alte e suggerisci formazione preventiva.

Rispondi SOLO con il JSON, senza altro testo.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text?.trim() || '';

    // Estrai il JSON dalla risposta (gestisce eventuali backtick)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Risposta AI non contiene JSON valido');

    const plan = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(plan) || plan.length === 0) throw new Error('Piano AI vuoto');

    // Valida campi obbligatori
    const validated = plan.slice(0, 5).map(row => ({
      criticita: String(row.criticita || ''),
      intervento: String(row.intervento || ''),
      risultato: String(row.risultato || ''),
    })).filter(r => r.criticita && r.intervento && r.risultato);

    if (validated.length === 0) throw new Error('Nessuna riga valida nel piano AI');

    return res.json({ plan: validated, source: 'ai' });

  } catch (e) {
    console.error('[AI intervention-plan] fallback:', e.message);
    return res.json({ plan: pianoDeterministico(zones), source: 'fallback', error: e.message });
  }
});
