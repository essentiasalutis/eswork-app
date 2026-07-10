import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../../../lib/auth';
import {
  getClientById,
  getPatientsByClient,
  getSessionsForClient,
  getReassessmentsT12ByClient,
  getMiniChecksByClient,
  getAssessmentsByClient,
  getResponsesByAssessment,
  insertGeneratedReport,
  insertDocument,
} from '../../../../lib/store';
import { getNotaValidazione } from '../../../../lib/pricing/settings';
import { stratificazioneOsservata } from '../../../../lib/scoring';
import { generateAndStorePdf, buildReportHtml } from '../../../../lib/pdf';
import { kAnonPartition, maskCount, tooSmall, K_ANON } from '../../../../lib/kanon';

export const config = { maxDuration: 60 };

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

  // k-anonymity sulla stratificazione L1/L2/L3 (con soppressione secondaria).
  // l1d/l2d/l3d = stringhe da PUBBLICARE; l1/l2/l3 restano per i calcoli interni.
  const stratTotal = l1 + l2 + l3;
  const stratP = tooSmall(stratTotal) ? null
    : Object.fromEntries(kAnonPartition([{ key: 'l1', count: l1 }, { key: 'l2', count: l2 }, { key: 'l3', count: l3 }], stratTotal).map(c => [c.key, c]));
  const ld = k => (!stratP || stratP[k].suppressed) ? `n.d.` : String(stratP[k].count);
  const l1d = ld('l1'), l2d = ld('l2'), l3d = ld('l3');

  // sessione "completata" = chiusa (la tabella sessions usa closed_at, non status)
  const completed = sessions.filter(s => s.closed_at).length;
  const planned = sessions.length;

  const sessionsWithNrs = sessions.filter(s => s.nrs_pre != null && s.nrs_post != null);
  const avgDelta = sessionsWithNrs.length > 0
    ? (sessionsWithNrs.reduce((a, s) => a + (s.nrs_pre - s.nrs_post), 0) / sessionsWithNrs.length).toFixed(1)
    : 'n.d.';

  const isAnnual = checkpoint === 't12';
  const checkLabel = checkpoint === 't3' ? '3 mesi' : checkpoint === 't6' ? '6 mesi' : '12 mesi (Annuale)';

  // ── Mini-check del checkpoint (risposte REALI dei dipendenti a T3/T6) ─────────
  let mc = null;
  if (!isAnnual) {
    const allChecks = await getMiniChecksByClient(id).catch(() => []);
    const phase = allChecks.filter(c => c.check_type === checkpoint);
    const nrsVals = phase.map(c => c.nrs_current).filter(v => v != null);
    // k-anon: se i mini-check compilati sono < k, l'intero spaccato è soppresso.
    const smallGroup = tooSmall(phase.length);
    const wc = phase.filter(c => c.wants_contact).length;
    const nc = phase.filter(c => c.triage_outcome === 'needs_contact').length;
    mc = {
      count: phase.length,
      smallGroup,
      avgNrs: smallGroup || !nrsVals.length ? 'n.d.' : (nrsVals.reduce((a, b) => a + b, 0) / nrsVals.length).toFixed(1),
      limitationsPct: smallGroup || !phase.length ? null : Math.round(phase.filter(c => c.has_limitations).length / phase.length * 100),
      // conteggi singoli mascherati se < k (riservato)
      wantsContact: maskCount(wc) == null ? 'n.d.' : wc,
      needsContact: maskCount(nc) == null ? 'n.d.' : nc,
    };
  }

  // ── KPI del Report Annuale (T12): prevalenza baseline↔T12 + PGIC ──────────────
  let t12 = null;
  if (isAnnual) {
    const reass = await getReassessmentsT12ByClient(id).catch(() => []);
    const pgicVals = reass.map(r => r.pgic).filter(v => v != null);
    const avgPgic = pgicVals.length ? (pgicVals.reduce((a, b) => a + b, 0) / pgicVals.length).toFixed(1) : 'n.d.';
    const improved = pgicVals.filter(v => v >= 4).length; // PGIC 4-5 = migliorato
    const improvedPct = pgicVals.length ? Math.round(improved / pgicVals.length * 100) : null;

    // FONTE OMOGENEA — aggregateNMQ ai DUE capi, MAI patients.level (che deriva col
    // trattamento → falserebbe il baseline). T0 = risposte CONGELATE dell'assessment
    // iniziale (il più vecchio del cliente); T12 = nmq_data CONGELATI dei re-assessment.
    // Stessa funzione + stessa definizione di L1 ai due capi. Confronto su prevalenza (%).
    const assessments = await getAssessmentsByClient(id).catch(() => []);
    const t0Ass = assessments[assessments.length - 1]; // ordinati desc → il più vecchio = intake
    const t0Answers = t0Ass ? await getResponsesByAssessment(t0Ass.id).catch(() => []) : [];
    const t0 = stratificazioneOsservata(t0Answers);
    const t12s = stratificazioneOsservata(reass.map(r => r.nmq_data).filter(Boolean));

    // k-anon: prevalenza e distribuzioni mostrate SOLO se ENTRAMBE le coorti ≥ K.
    const prevalenceShown = t0.n >= K_ANON && t12s.n >= K_ANON;
    const prevalenceDeltaPts = prevalenceShown ? (t0.l1pct - t12s.l1pct) : null; // punti % di riduzione L1
    const nd = (s) => prevalenceShown ? s : 'n.d.';
    t12 = {
      count: reass.length, avgPgic, improvedPct,
      t0N: t0.n, t12N: t12s.n, prevalenceShown, prevalenceDeltaPts,
      t0L1: nd(`${t0.l1pct}%`), t12L1: nd(`${t12s.l1pct}%`),
      t0Strat: nd(`L1 ${t0.l1pct}%, L2 ${t0.l2pct}%, L3 ${t0.l3pct}%`),
      t12Strat: nd(`L1 ${t12s.l1pct}%, L2 ${t12s.l2pct}%, L3 ${t12s.l3pct}%`),
      _t0: t0, _t12: t12s, // grezzi per il Blocco 2 (confronti A/B)
    };
  }

  const prompt = isAnnual ? `Sei un consulente clinico ES Work. Genera il REPORT ANNUALE (12 mesi) per ${client.name}, da consegnare alla direzione e utilizzabile per il bilancio di sostenibilità.

DATI ANNO 1 (i valori "n.d." sono soppressi per anonimato/k-anonymity, < ${K_ANON}: NON dedurli né stimarli):
- Prevalenza osservata all'intake (${t12.t0N} risposte T0): ${t12.t0Strat}
- Sessioni completate/pianificate: ${completed}/${planned}
- Re-assessment a 12 mesi completati: ${t12.count}
- Prevalenza osservata a 12 mesi (${t12.t12N} re-assessment): ${t12.t12Strat}
- Settore: ${client.sector === 1 ? 'Manifattura' : 'Servizi'}

STRUTTURA (markdown, ## per titoli):

## Sintesi dei risultati a 12 mesi
(3-4 punti chiave per la direzione)

## I tre KPI di risultato
Presenta in tabella i tre indicatori v4:
1. **Riduzione del dolore** — riduzione media NRS per sessione: ${avgDelta} punti.
2. **Miglioramento percepito (PGIC)** — PGIC medio ${t12.avgPgic}/5${t12.improvedPct != null ? `, ${t12.improvedPct}% dei dipendenti rivalutati riporta un miglioramento (PGIC 4-5)` : ''}.
3. **Variazione della prevalenza L1** — prevalenza L1 OSSERVATA (stessa strumentazione ai due capi): dal ${t12.t0L1} all'intake al ${t12.t12L1} a 12 mesi${t12.prevalenceShown && t12.prevalenceDeltaPts != null ? ` (${t12.prevalenceDeltaPts >= 0 ? '−' : '+'}${Math.abs(t12.prevalenceDeltaPts)} punti)` : ''}. NON confrontare conteggi grezzi (coorti T0/T12 di numerosità diversa: ${t12.t0N} vs ${t12.t12N}).

## Confronto prima/dopo
(commento al cambiamento della distribuzione L1/L2/L3 intake → T12)

## Documentazione INAIL OT23
(elementi per la richiesta di riduzione del tasso: interventi erogati, dipendenti coinvolti, ore, monitoraggio continuo)

## Raccomandazioni per l'Anno 2
(3-4 azioni: mantenimento, prevenzione L2, formazione avanzata)

${t12.count === 0 ? 'NOTA: nessun re-assessment a 12 mesi ancora registrato — segnala che i KPI di esito saranno disponibili al completamento dei re-assessment.' : ''}
Tono: clinico, orientato ai risultati e alla direzione. Italiano. Max 650 parole.` : `Sei un consulente clinico ES Work. Genera un Report Intermedio professionale a ${checkLabel} per il cliente ${client.name}.

DATI CLINICI (i valori "n.d." sono soppressi per anonimato/k-anonymity, < ${K_ANON}: NON dedurli né stimarli):
- Pazienti L1 (trattamento): ${l1d}
- Pazienti L2 (monitoraggio): ${l2d}
- Pazienti L3 (prevenzione): ${l3d}
- Sessioni completate/pianificate: ${completed}/${planned}
- Riduzione media NRS per sessione: ${avgDelta} punti
- Settore: ${client.sector === 1 ? 'Manifattura' : 'Servizi'}

MINI-CHECK ${checkpoint.toUpperCase()} (questionari compilati dai dipendenti a ${checkLabel}):
${mc.smallGroup ? `- Spaccato mini-check non pubblicabile: meno di ${K_ANON} compilati (tutela anonimato).` : `- Compilati: ${mc.count}
- NRS medio dichiarato: ${mc.avgNrs}
${mc.limitationsPct != null ? `- Con limitazioni funzionali: ${mc.limitationsPct}%` : ''}
- Richiedono contatto: ${mc.wantsContact} (triage: ${mc.needsContact} da ricontattare)`}
${mc.count === 0 ? 'NOTA: nessun mini-check ancora compilato — segnala che i KPI di percezione arriveranno coi questionari.' : ''}

STRUTTURA REPORT (markdown, ## per titoli):

## Highlights Principali a ${checkLabel}
(3-4 punti chiave di rilievo clinico e operativo)

## KPI Clinici
(tabella o lista strutturata: sessioni, NRS sedute, mini-check ${checkpoint.toUpperCase()} con NRS dichiarato e limitazioni, pazienti per livello)

## Trend e Analisi
(andamento NRS, compliance pazienti, situazioni da monitorare)

## Problematiche Emerse
(eventuali criticità operative o cliniche)

## Prossimi Passi
(3-4 azioni per i prossimi ${checkpoint === 't3' ? '3' : '6'} mesi)

Tono: clinico, analitico, orientato ai dati. Italiano. Max 600 parole.`;

  const reportType = `checkpoint_${checkpoint}`;
  // Nota di validazione deterministica in fondo al report (mai dall'AI).
  const notaValidazione = await getNotaValidazione();
  const conNota = t => `${t}\n\n---\n\n*${notaValidazione}*`;

  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = conNota(generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, l3, completed, planned, avgDelta, t12, mc));
    // PDF prima dell'insert: così pdf_url resta sul record e il report è riapribile col PDF
    const pdfUrl = await tryGeneratePdf(client, reportType, fallback, id, checkpoint).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: reportType, content_text: fallback, checkpoint, created_by: 'system', pdf_url: pdfUrl }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', pdf_url: pdfUrl, report_id: rec?.id });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
    const report = conNota(message.content[0]?.text || '');
    const pdfUrl = await tryGeneratePdf(client, reportType, report, id, checkpoint).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: reportType, content_text: report, checkpoint, created_by: 'admin', pdf_url: pdfUrl }).catch(() => null);
    return res.json({ report, source: 'ai', pdf_url: pdfUrl, report_id: rec?.id });
  } catch (e) {
    const fallback = conNota(generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, l3, completed, planned, avgDelta, t12, mc));
    const pdfUrl = await tryGeneratePdf(client, reportType, fallback, id, checkpoint).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: reportType, content_text: fallback, checkpoint, created_by: 'system', pdf_url: pdfUrl }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', error: e.message, pdf_url: pdfUrl, report_id: rec?.id });
  }
});

function generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, l3, completed, planned, avgDelta, t12, mc) {
  // k-anon sulla stratificazione intake L1/L2/L3 (soppressione secondaria inclusa)
  const stratTotal = l1 + l2 + l3;
  const SP = tooSmall(stratTotal) ? null
    : Object.fromEntries(kAnonPartition([{ key: 'l1', count: l1 }, { key: 'l2', count: l2 }, { key: 'l3', count: l3 }], stratTotal).map(c => [c.key, c]));
  const ld = k => (!SP || SP[k].suppressed) ? 'n.d.' : String(SP[k].count);
  const l1d = ld('l1'), l2d = ld('l2'), l3d = ld('l3');

  if (checkpoint === 't12' && t12) {
    return `## Report Annuale — ${client.name}

Sintesi dei risultati del programma ES Work al termine dell'Anno 1${t12.count === 0 ? ' (re-assessment a 12 mesi non ancora completati: i KPI di esito saranno disponibili al loro completamento).' : '.'}

## I tre KPI di risultato

| KPI | Valore |
|-----|--------|
| Riduzione del dolore (NRS media/seduta) | ${avgDelta} punti |
| Miglioramento percepito (PGIC medio) | ${t12.avgPgic}/5${t12.improvedPct != null ? ` · ${t12.improvedPct}% migliorati` : ''} |
| Prevalenza L1 osservata (intake → 12 mesi) | ${t12.t0L1} → ${t12.t12L1}${t12.prevalenceShown && t12.prevalenceDeltaPts != null ? ` (${t12.prevalenceDeltaPts >= 0 ? '−' : '+'}${Math.abs(t12.prevalenceDeltaPts)} punti)` : ''} |

## Confronto prima/dopo

Distribuzione osservata all'intake (${t12.t0N} risposte T0): ${t12.t0Strat}. A 12 mesi (${t12.t12N} re-assessment): ${t12.t12Strat}.

I valori "n.d." sono soppressi per tutela dell'anonimato (k-anonymity, gruppo < ${K_ANON}).

## Documentazione INAIL OT23

Elementi per la richiesta di riduzione del tasso (modello OT23): ${completed} interventi erogati su ${planned} pianificati, monitoraggio continuo dei dipendenti, formazione collettiva e sportello osteopatico in sede.

## Raccomandazioni per l'Anno 2

1. Mantenimento dei risultati per i dipendenti trattati
2. Prevenzione attiva per i L2 idonei
3. Modulo formativo avanzato
4. Re-assessment annuale di controllo`;
  }
  return `## Highlights Principali a ${checkLabel}

Il programma ES Work per **${client.name}** ha raggiunto il checkpoint a ${checkLabel} con risultati in linea con le aspettative cliniche.

- ${completed} sessioni completate su ${planned} pianificate (${planned > 0 ? Math.round(completed/planned*100) : 0}% completamento)
- Riduzione media NRS: **${avgDelta} punti** per sessione
- ${l1d} pazienti in protocollo L1 attivo, ${l2d} in monitoraggio L2

## KPI Clinici

| Indicatore | Valore |
|-----------|--------|
| Sessioni completate | ${completed} / ${planned} |
| Riduzione NRS media (sedute) | ${avgDelta} punti |
| Mini-check ${checkpoint.toUpperCase()} compilati | ${mc ? (mc.smallGroup ? 'n.d.' : mc.count) : 0} |
| NRS medio dichiarato (mini-check) | ${mc ? mc.avgNrs : 'n.d.'} |
| Con limitazioni funzionali | ${mc && mc.limitationsPct != null ? mc.limitationsPct + '%' : 'n.d.'} |
| Richiedono contatto | ${mc ? mc.needsContact : 0} |
| Pazienti L1 attivi | ${l1d} |
| Pazienti L2 monitorati | ${l2d} |

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

async function tryGeneratePdf(client, report_type, content_text, client_id, checkpoint) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const html = buildReportHtml({ client, report_type, content_text, checkpoint });
  const filename = `${report_type}_${client_id}_${Date.now()}.pdf`;
  const { url } = await generateAndStorePdf(html, filename, 'reports');
  await insertDocument({ client_id, type: report_type, file_url: url, content_text }).catch(() => {});
  return url;
}
