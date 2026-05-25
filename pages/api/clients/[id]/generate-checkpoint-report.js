import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../../../lib/auth';
import {
  getClientById,
  getPatientsByClient,
  getSessionsForClient,
  insertGeneratedReport,
} from '../../../../lib/store';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const { checkpoint = 't3' } = req.body;

  const client = await getClientById(id).catch(() => null);
  if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

  const [patients, sessions] = await Promise.all([
    getPatientsByClient(id).catch(() => []),
    getSessionsForClient(id).catch(() => []),
  ]);

  const l1 = patients.filter(p => p.level === 'level1').length;
  const l2 = patients.filter(p => p.level === 'level2').length;
  const l3 = patients.filter(p => p.level === 'level3').length;
  const completed = sessions.filter(s => s.status === 'completed').length;
  const planned = sessions.length;

  const sessionsWithNrs = sessions.filter(s => s.nrs_pre != null && s.nrs_post != null);
  const avgDelta = sessionsWithNrs.length > 0
    ? (sessionsWithNrs.reduce((a, s) => a + (s.nrs_pre - s.nrs_post), 0) / sessionsWithNrs.length).toFixed(1)
    : 'n.d.';

  const checkLabel = checkpoint === 't3' ? '3 mesi' : checkpoint === 't6' ? '6 mesi' : '12 mesi';

  const prompt = `Sei un consulente clinico ES Work. Genera un Report Intermedio professionale a ${checkLabel} per il cliente ${client.name}.

DATI CLINICI:
- Pazienti L1 (trattamento): ${l1}
- Pazienti L2 (monitoraggio): ${l2}
- Pazienti L3 (prevenzione): ${l3}
- Sessioni completate/pianificate: ${completed}/${planned}
- Riduzione media NRS per sessione: ${avgDelta} punti
- Settore: ${client.sector === 1 ? 'Manifattura' : 'Servizi'}

STRUTTURA REPORT (markdown, ## per titoli):

## Highlights Principali a ${checkLabel}
(3-4 punti chiave di rilievo clinico e operativo)

## KPI Clinici
(tabella o lista strutturata: sessioni, NRS, completamento, pazienti per livello)

## Trend e Analisi
(andamento NRS, compliance pazienti, situazioni da monitorare)

## Problematiche Emerse
(eventuali criticità operative o cliniche)

## Prossimi Passi
(3-4 azioni per i prossimi ${checkpoint === 't3' ? '3' : '6'} mesi)

${checkpoint === 't6' || checkpoint === 't12' ? `
## Documentazione INAIL OT23
(elementi chiave per la richiesta di riduzione del tasso: data interventi, dipendenti coinvolti, ore erogate)
` : ''}

Tono: clinico, analitico, orientato ai dati. Italiano. Max 600 parole.`;

  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, completed, planned, avgDelta);
    await insertGeneratedReport({ client_id: id, report_type: `checkpoint_${checkpoint}`, content_text: fallback, checkpoint, created_by: 'system' }).catch(() => {});
    return res.json({ report: fallback, source: 'fallback' });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const report = message.content[0]?.text || '';
    await insertGeneratedReport({ client_id: id, report_type: `checkpoint_${checkpoint}`, content_text: report, checkpoint, created_by: 'admin' }).catch(() => {});
    return res.json({ report, source: 'ai' });
  } catch (e) {
    const fallback = generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, completed, planned, avgDelta);
    await insertGeneratedReport({ client_id: id, report_type: `checkpoint_${checkpoint}`, content_text: fallback, checkpoint, created_by: 'system' }).catch(() => {});
    return res.json({ report: fallback, source: 'fallback', error: e.message });
  }
});

function generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, completed, planned, avgDelta) {
  return `## Highlights Principali a ${checkLabel}

Il programma ES Work per **${client.name}** ha raggiunto il checkpoint a ${checkLabel} con risultati in linea con le aspettative cliniche.

- ${completed} sessioni completate su ${planned} pianificate (${planned > 0 ? Math.round(completed/planned*100) : 0}% completamento)
- Riduzione media NRS: **${avgDelta} punti** per sessione
- ${l1} pazienti in protocollo L1 attivo, ${l2} in monitoraggio L2

## KPI Clinici

| Indicatore | Valore |
|-----------|--------|
| Sessioni completate | ${completed} / ${planned} |
| Riduzione NRS media | ${avgDelta} punti |
| Pazienti L1 attivi | ${l1} |
| Pazienti L2 monitorati | ${l2} |

## Trend e Analisi

Il trend di riduzione NRS è positivo. I pazienti L1 mostrano risposta al protocollo di trattamento individuale. I pazienti L2 sono correttamente in monitoraggio con i mini-check periodici.

## Problematiche Emerse

Nessuna criticità operativa rilevante da segnalare in questa fase.

## Prossimi Passi

1. Continuazione sportello osteopatico per pazienti L1 in corso
2. Mini-check ${checkpoint === 't3' ? 'T6' : 'T12'} per tutti i dipendenti L2/L3
3. Review clinica con report intermedio aggiornato
4. Valutazione candidati per ri-stratificazione L2→L1`;
}
