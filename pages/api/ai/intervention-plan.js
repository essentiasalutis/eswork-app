import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../../lib/auth';

// ─── Fallback deterministico ──────────────────────────────────────────────────

function fallbackPlan(zones, level1Count) {
  const INTERVENTIONS = {
    'Collo': 'Sportello osteopatico — protocollo cervicale + ergonomia postazione',
    'Spalle': 'Sportello osteopatico — protocollo spalle + formazione postura',
    'Schiena alta (dorsale)': 'Sportello osteopatico — rachide dorsale + ergonomia workstation',
    'Schiena bassa (lombare)': 'Sportello osteopatico — lombare + formazione movimentazione carichi',
    'Gomiti': 'Sportello osteopatico — arto superiore + analisi postura lavoro',
    'Polsi / Mani': 'Sportello osteopatico — polso/mano + ergonomia strumenti lavoro',
    'Anche / Cosce': 'Sportello osteopatico — arto inferiore + formazione stazione eretta',
    'Ginocchia': 'Sportello osteopatico — protocollo ginocchio + analisi del passo',
    'Caviglie / Piedi': 'Sportello osteopatico — arto inferiore distale + calzature professionali',
  };

  // Prendi le zone >= 30%, o le top-2 se nessuna supera la soglia
  let critical = zones.filter(z => z.pct12 >= 30).sort((a, b) => b.pct12 - a.pct12);
  if (critical.length === 0) {
    critical = [...zones].sort((a, b) => b.pct12 - a.pct12).slice(0, 2);
  }
  critical = critical.slice(0, 5);

  return critical.map(z => ({
    criticita: `${z.pct12}% disturbi ${z.zone.toLowerCase()}`,
    intervento: INTERVENTIONS[z.zone] || 'Sportello osteopatico + formazione mirata',
    risultato: 'Riduzione sintomi 20-30% in 12 mesi',
  }));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { zones, clientName, sector, level1Count } = req.body;

  if (!zones || !Array.isArray(zones)) {
    return res.status(400).json({ error: 'zones richiesto' });
  }

  // Se manca la chiave API → fallback diretto
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ plan: fallbackPlan(zones, level1Count), source: 'fallback_no_key' });
  }

  // Zone con prevalenza >= 30% (o top-2 se nessuna)
  let criticalZones = zones.filter(z => z.pct12 >= 30).sort((a, b) => b.pct12 - a.pct12);
  if (criticalZones.length === 0) {
    criticalZones = [...zones].sort((a, b) => b.pct12 - a.pct12).slice(0, 2);
  }

  const zoneText = criticalZones.map(z => `- ${z.zone}: ${z.pct12}%`).join('\n');
  const sectorLabel = sector === 1 ? 'manifattura/produzione' : 'ufficio/servizi';

  const prompt = `Sei un consulente di salute occupazionale. Genera un piano di intervento per un'azienda basandoti su questi dati NMQ:
${zoneText}
Azienda: ${clientName}, settore: ${sectorLabel}, dipendenti Livello 1: ${level1Count}

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
    return res.json({ plan: fallbackPlan(zones, level1Count), source: 'fallback', error: e.message });
  }
});
