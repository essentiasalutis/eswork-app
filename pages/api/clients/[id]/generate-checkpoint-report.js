import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../../../lib/auth';
import {
  getClientById,
  getPatientsByClient,
  getSessionsForClient,
  getReassessmentsT12ByClient,
  getMiniChecksByClient,
  insertGeneratedReport,
  insertDocument,
} from '../../../../lib/store';
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
    const r1 = reass.filter(r => r.computed_level === 'level1').length;
    const r2 = reass.filter(r => r.computed_level === 'level2').length;
    const r3 = reass.filter(r => r.computed_level === 'level3').length;
    const pgicVals = reass.map(r => r.pgic).filter(v => v != null);
    const avgPgic = pgicVals.length ? (pgicVals.reduce((a, b) => a + b, 0) / pgicVals.length).toFixed(1) : 'n.d.';
    const improved = pgicVals.filter(v => v >= 4).length; // PGIC 4-5 = migliorato
    const improvedPct = pgicVals.length ? Math.round(improved / pgicVals.length * 100) : null;
    const baselineTreat = l1; // L1 all'intake (necessitano trattamento)
    const t12Treat = r1;      // L1 al re-assessment
    const prevalenceDelta = baselineTreat > 0 ? Math.round((baselineTreat - t12Treat) / baselineTreat * 100) : null;
    // k-anon sulla distribuzione T12 (r1/r2/r3) + mascheramento dei conteggi piccoli.
    const small = tooSmall(reass.length);
    const RP = small ? null
      : Object.fromEntries(kAnonPartition([{ key: 'r1', count: r1 }, { key: 'r2', count: r2 }, { key: 'r3', count: r3 }], reass.length).map(c => [c.key, c]));
    const rd = k => (!RP || RP[k].suppressed) ? 'n.d.' : String(RP[k].count);
    const baselineTreatD = maskCount(baselineTreat) == null ? 'n.d.' : String(baselineTreat);
    const t12TreatD = (!RP || RP.r1.suppressed) ? 'n.d.' : String(t12Treat);
    const prevalenceShown = !small && maskCount(baselineTreat) != null && RP && !RP.r1.suppressed;
    t12 = {
      count: reass.length, r1, r2, r3, avgPgic, improvedPct, baselineTreat, t12Treat, prevalenceDelta,
      r1d: rd('r1'), r2d: rd('r2'), r3d: rd('r3'), baselineTreatD, t12TreatD, prevalenceShown, small,
    };
  }

  const prompt = isAnnual ? `Sei un consulente clinico ES Work. Genera il REPORT ANNUALE (12 mesi) per ${client.name}, da consegnare alla direzione e utilizzabile per il bilancio di sostenibilità.

DATI ANNO 1 (i valori "n.d." sono soppressi per anonimato/k-anonymity, < ${K_ANON}: NON dedurli né stimarli):
- Popolazione all'intake: L1 ${l1d}, L2 ${l2d}, L3 ${l3d}
- Sessioni completate/pianificate: ${completed}/${planned}
- Re-assessment a 12 mesi completati: ${t12.count}
- Distribuzione livelli a T12: L1 ${t12.r1d}, L2 ${t12.r2d}, L3 ${t12.r3d}
- Settore: ${client.sector === 1 ? 'Manifattura' : 'Servizi'}

STRUTTURA (markdown, ## per titoli):

## Sintesi dei risultati a 12 mesi
(3-4 punti chiave per la direzione)

## I tre KPI di risultato
Presenta in tabella i tre indicatori v4:
1. **Riduzione del dolore** — riduzione media NRS per sessione: ${avgDelta} punti.
2. **Miglioramento percepito (PGIC)** — PGIC medio ${t12.avgPgic}/5${t12.improvedPct != null ? `, ${t12.improvedPct}% dei dipendenti rivalutati riporta un miglioramento (PGIC 4-5)` : ''}.
3. **Variazione della prevalenza** — dipendenti che necessitano trattamento (L1): da ${t12.baselineTreatD} all'intake a ${t12.t12TreatD} a 12 mesi${t12.prevalenceShown && t12.prevalenceDelta != null ? ` (${t12.prevalenceDelta >= 0 ? '−' : '+'}${Math.abs(t12.prevalenceDelta)}%)` : ''}.

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

  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, l3, completed, planned, avgDelta, t12, mc);
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
    const report = message.content[0]?.text || '';
    const pdfUrl = await tryGeneratePdf(client, reportType, report, id, checkpoint).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: reportType, content_text: report, checkpoint, created_by: 'admin', pdf_url: pdfUrl }).catch(() => null);
    return res.json({ report, source: 'ai', pdf_url: pdfUrl, report_id: rec?.id });
  } catch (e) {
    const fallback = generateFallbackCheckpoint(client, checkpoint, checkLabel, l1, l2, l3, completed, planned, avgDelta, t12, mc);
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
| Dipendenti che necessitano trattamento (L1) | ${t12.baselineTreatD} → ${t12.t12TreatD}${t12.prevalenceShown && t12.prevalenceDelta != null ? ` (${t12.prevalenceDelta >= 0 ? '−' : '+'}${Math.abs(t12.prevalenceDelta)}%)` : ''} |

## Confronto prima/dopo

Distribuzione livelli all'intake: L1 ${l1d}, L2 ${l2d}, L3 ${l3d}. A 12 mesi (su ${t12.count} re-assessment): L1 ${t12.r1d}, L2 ${t12.r2d}, L3 ${t12.r3d}.

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
