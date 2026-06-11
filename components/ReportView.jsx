import { useState } from 'react';
import {
  aggregateNMQ,
  trafficLight, TL_COLOR, TL_BG, TL_BORDER,
  TYPE_LABELS, generateSummaryText,
} from '../lib/scoring';
import { CONFIG } from '../lib/config';

// ─── Commento clinico AI (parte discorsiva integrata nel report dati) ──────────
// Un solo report di attivazione: cruscotti/dati + commento discorsivo AI.
// Mostra l'ultimo commento salvato in archivio; "Genera/Aggiorna" chiama
// l'endpoint activation (che archivia anche in generated_reports).

function renderMd(text) {
  return (text || '').split('\n').map((line, i) => {
    if (line.trim() === '---') return <hr key={i} className="my-3 border-gray-100" />;
    if (line.startsWith('# ')) return <h3 key={i} className="text-base font-bold text-gray-900 mt-4 mb-1">{line.slice(2)}</h3>;
    if (line.startsWith('## ')) return <h3 key={i} className="text-base font-bold text-gray-900 mt-4 mb-1">{line.slice(3)}</h3>;
    if (line.startsWith('### ')) return <h4 key={i} className="text-sm font-bold text-gray-800 mt-3 mb-1">{line.slice(4)}</h4>;
    if (line.startsWith('- ')) return <li key={i} className="text-sm text-gray-700 ml-4">{line.slice(2).replace(/\*\*/g, '')}</li>;
    if (line.match(/^\d+\. /)) return <li key={i} className="text-sm text-gray-700 ml-4">{line.replace(/^\d+\. /, '').replace(/\*\*/g, '')}</li>;
    if (line.startsWith('|')) return null; // le tabelle KPI sono già nei cruscotti del report
    if (line.trim() === '') return <div key={i} className="h-1.5" />;
    return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line.replace(/\*\*/g, '')}</p>;
  });
}

function AiCommentSection({ clientId, initialText }) {
  const [text, setText] = useState(initialText || null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/generate-activation-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json().catch(() => null);
      if (d?.report) setText(d.report);
      else alert(d?.error || 'Errore nella generazione del commento.');
    } catch { alert('Errore di rete.'); }
    setBusy(false);
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Commento clinico e raccomandazioni ✨ AI</div>
        <button onClick={generate} disabled={busy}
          className="no-print text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100 disabled:opacity-50">
          {busy ? '⏳ Generazione (15-30s)…' : text ? '↻ Aggiorna commento' : '✨ Genera commento AI'}
        </button>
      </div>
      {text ? (
        <div>{renderMd(text)}</div>
      ) : (
        <p className="text-sm text-gray-400 no-print">Nessun commento ancora generato. Clicca &quot;Genera commento AI&quot; per aggiungere la parte discorsiva (executive summary, analisi e raccomandazioni) a questo report.</p>
      )}
    </div>
  );
}

// ─── Semaphore ────────────────────────────────────────────────────────────────

function Semaphore({ type, score, value, label, subtitle }) {
  const numeric = score !== undefined ? score : parseFloat(value);
  const color = trafficLight(type, numeric);
  return (
    <div
      className="rounded-2xl p-3 text-center print-page"
      style={{
        background: TL_BG[color],
        border: `1.5px solid ${TL_BORDER[color]}`,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {/* Cerchio pieno invece di box-shadow (stampa meglio) */}
      <div
        className="w-4 h-4 rounded-full mx-auto mb-1"
        style={{
          background: TL_COLOR[color],
          printColorAdjust: 'exact',
          WebkitPrintColorAdjust: 'exact',
        }}
      />
      <div className="text-xs text-gray-600 mb-0.5">{label}</div>
      <div className="text-xl font-bold" style={{ color: TL_COLOR[color] }}>{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function HBar({ label, value, max = 100 }) {
  const color = value > 50 ? '#dc2626' : value > 30 ? '#ca8a04' : '#16a34a';
  const pct = Math.max((value / max) * 100, value > 0 ? 4 : 0);
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="w-36 text-xs text-gray-600 text-right flex-shrink-0 truncate">{label}</div>
      <div
        className="flex-1 h-4 rounded overflow-hidden"
        style={{ background: '#f3f4f6', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
      >
        <div
          className="h-full rounded flex items-center justify-end pr-1.5 text-white text-xs font-semibold"
          style={{
            width: `${pct}%`,
            background: color,
            minWidth: value > 0 ? 28 : 0,
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
          }}
        >
          {value > 0 && `${value}%`}
        </div>
      </div>
    </div>
  );
}

// ─── Comparison bar ───────────────────────────────────────────────────────────

function CompareBar({ label, before, after }) {
  const mx = Math.max(before, after, 1);
  return (
    <div className="mb-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex gap-2">
        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
          <div
            className="h-full bg-slate-400 rounded flex items-center justify-end pr-1.5 text-white text-xs"
            style={{ width: `${(before / mx) * 100}%`, minWidth: before > 0 ? 24 : 0 }}
          >
            {before}%
          </div>
        </div>
        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
          <div
            className="h-full bg-green-500 rounded flex items-center justify-end pr-1.5 text-white text-xs"
            style={{ width: `${(after / mx) * 100}%`, minWidth: after > 0 ? 24 : 0 }}
          >
            {after}%
          </div>
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-0.5">
        <span>Baseline</span><span>Attuale</span>
      </div>
    </div>
  );
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function Delta({ before, after, inverse = false }) {
  const diff = after - before;
  const good = inverse ? diff < 0 : diff > 0;
  if (diff === 0) return <span className="text-gray-400 text-xs ml-1">(=)</span>;
  return (
    <span className={`text-xs ml-1 font-semibold ${good ? 'text-green-600' : 'text-red-500'}`}>
      ({diff > 0 ? '+' : ''}{Math.round(diff * 10) / 10})
    </span>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 mt-4 border-b border-gray-200 pb-1">
      {children}
    </div>
  );
}

// ─── Legend box ──────────────────────────────────────────────────────────────

function LegendBox({ children }) {
  return (
    <div className="border border-gray-300 rounded-xl p-2.5 mb-2 text-xs text-gray-600 leading-relaxed"
      style={{ background: '#f9fafb', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {children}
    </div>
  );
}

// ─── Livelli box ─────────────────────────────────────────────────────────────

function LevelBoxes({ nmq }) {
  const levels = [
    {
      count: nmq.level1.count, pct: nmq.level1.pct,
      label: 'Trattamento — Anno 1',
      subtitle: 'Problemi che impattano le attività',
      bg: '#FFEBEE', border: '#E74C3C', color: '#E74C3C',
    },
    {
      count: nmq.level2.count, pct: nmq.level2.pct,
      label: 'Prevenzione — Anno 2',
      subtitle: 'Segnali da monitorare',
      bg: '#FFF8E1', border: '#F39C12', color: '#F39C12',
    },
    {
      count: nmq.level3.count, pct: nmq.level3.pct,
      label: 'Solo formazione',
      subtitle: 'Postura ed ergonomia per tutti',
      bg: '#E8F5E9', border: '#16a34a', color: '#16a34a',
    },
  ];
  return (
    <div className="mb-2">
      <div className="grid grid-cols-3 gap-2 mb-2">
        {levels.map((l, i) => (
          <div
            key={i}
            className="rounded-2xl p-3 text-center print-page"
            style={{ background: l.bg, border: `1.5px solid ${l.border}`, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            <div className="text-2xl font-bold" style={{ color: l.color }}>{l.count}</div>
            <div className="text-xs text-gray-600 mt-0.5">dip. ({l.pct}%)</div>
            <div className="text-xs font-semibold mt-2 leading-tight" style={{ color: l.color }}>{l.label}</div>
            <div className="text-xs text-gray-400 mt-1 leading-tight hidden sm:block">{l.subtitle}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-400 text-center mb-2">
        Prevalenza generica: <strong>{nmq.prevalence.pct}%</strong> ha riportato almeno un fastidio negli ultimi 12 mesi (dato informativo)
      </div>
    </div>
  );
}

// ─── Analisi per ruolo ────────────────────────────────────────────────────────

function RoleAnalysis({ byRole }) {
  const prod = byRole.production;
  const off = byRole.office;
  const hasEnoughData = prod.n >= 10 && off.n >= 10;

  if (prod.n === 0 && off.n === 0) return null;

  if (!hasEnoughData) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 mb-3 text-xs text-gray-500 text-center">
        Analisi per ruolo non disponibile: uno dei gruppi ha meno di 10 risposte
        {prod.n > 0 && off.n > 0 && ` (Produzione: ${prod.n}, Ufficio: ${off.n})`}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 mb-3 print-page">
      {[
        { label: 'In produzione', data: prod },
        { label: 'In ufficio', data: off },
      ].map(({ label, data }) => (
        <div key={label} className="bg-white rounded-2xl border border-gray-200 p-3">
          <div className="text-xs font-semibold text-gray-600 mb-2">
            {label} <span className="font-normal text-gray-400">({data.n} risp.)</span>
          </div>
          {data.zones.slice(0, 5).map((z, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1">
              <div className="w-20 text-xs text-gray-500 truncate text-right flex-shrink-0">{z.zone}</div>
              <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${z.pct12}%`,
                    background: z.pct12 > 50 ? '#dc2626' : z.pct12 > 30 ? '#ca8a04' : '#16a34a',
                    minWidth: z.pct12 > 0 ? 16 : 0,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 w-8 flex-shrink-0">{z.pct12}%</div>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
            <span className="text-red-600 font-semibold">L1: {data.level1.count}</span>
            <span className="text-gray-400 ml-1">({data.level1.pct}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function ReportFooter() {
  return (
    <div className="mt-6 pt-4 border-t-2 border-green-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo-es.png" alt="Essentia Salutis" className="w-8 h-8 object-contain" />
          <div>
            <div className="text-sm font-bold text-gray-800">ES <span style={{color:'#16a34a'}}>Work</span> — {CONFIG.company_name}</div>
            <div className="text-xs text-gray-500">{CONFIG.company_address} · {CONFIG.contact_phone} · {CONFIG.contact_email}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 italic mb-1">Powered by ES Work AI · Piattaforma digitale per la prevenzione e cura dell'apparato muscolo-scheletrico</div>
          <div className="text-xs text-gray-400">
            Documento riservato e confidenziale.<br/>
            Riproduzione vietata senza autorizzazione scritta.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReportView({ assessment, client, baseline, onOpenCalculator, aiInitialText }) {
  const responseList = assessment.responseList || [];
  const n = responseList.length;

  if (n === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        Nessuna risposta raccolta.
      </div>
    );
  }

  const nmq = aggregateNMQ(responseList);

  const baseResp = baseline?.responseList || [];
  const baseNmq = baseResp.length > 0 ? aggregateNMQ(baseResp) : null;
  const hasBaseline = !!baseNmq;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-6" id="report-root">
      {/* CSS stampa */}
      <style>{`
        @media print {
          @page { size: A4; margin: 1.2cm 1.5cm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          #report-root { padding: 0 !important; }
          #report-root > div { margin-bottom: 8px !important; }
          .rounded-2xl { border-radius: 8px !important; }
          .p-4 { padding: 8px !important; }
          .p-5 { padding: 10px !important; }
          .p-3 { padding: 6px !important; }
          .mb-6 { margin-bottom: 10px !important; }
          .mb-4 { margin-bottom: 8px !important; }
          .mb-3 { margin-bottom: 6px !important; }
          .mb-2 { margin-bottom: 4px !important; }
          .mt-6 { margin-top: 10px !important; }
          .py-5 { padding-top: 10px !important; padding-bottom: 10px !important; }
          .pb-6 { padding-bottom: 0 !important; }
          .gap-3 { gap: 8px !important; }
          .space-y-3 > * + * { margin-top: 6px !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-end justify-between py-5 border-b-2 border-green-600 mb-4">
        <div className="flex items-center gap-3">
          <img src="/logo-es.png" alt="Essentia Salutis" className="w-12 h-12 object-contain" />
          <div>
            <div className="text-2xl font-bold text-gray-900">
              ES <span className="text-green-600">Work</span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">{TYPE_LABELS[assessment.type]}</div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">
          <div>{new Date(assessment.created_at || Date.now()).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          <div>{n} risposte</div>
        </div>
      </div>

      {/* Client info */}
      <div className="mb-2">
        <div className="text-lg font-semibold text-gray-900">{client?.name}</div>
        <div className="text-sm text-gray-500">
          {client?.employees} dipendenti · {client?.sector === 1 ? 'Manifattura/Produzione' : 'Ufficio/IT/Servizi'}
        </div>
      </div>

      {/* Sintesi — Mod 7: rimosso "automatica" */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-2 print-page">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Sintesi</div>
        <div className="flex items-center gap-1.5 mb-2">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
          <span className="text-xs text-gray-400 italic">Analisi generata da ES Work AI — sistema di intelligenza artificiale per la prevenzione e cura dell'apparato muscolo-scheletrico</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {generateSummaryText(nmq)}
        </p>
      </div>

      {/* KPI Dashboard */}
      <SectionTitle>Cruscotto sintetico</SectionTitle>
      <div className="grid gap-3 mb-2 grid-cols-3">
        <Semaphore type="nmq" score={nmq.level1.pct} value={`${nmq.level1.pct}%`} label="Livello 1" subtitle="Trattamento" />
        <div className="rounded-2xl p-3 text-center bg-yellow-50 border border-yellow-100">
          <div className="text-xs text-gray-600 mb-0.5">Livello 2</div>
          <div className="text-xl font-bold text-yellow-600">{nmq.level2.pct}%</div>
          <div className="text-xs text-gray-400 mt-0.5">Monitoraggio</div>
        </div>
        <div className="rounded-2xl p-3 text-center bg-green-50 border border-green-100">
          <div className="text-xs text-gray-600 mb-0.5">Livello 3</div>
          <div className="text-xl font-bold text-green-600">{nmq.level3.pct}%</div>
          <div className="text-xs text-gray-400 mt-0.5">Formazione</div>
        </div>
      </div>

      {/* Legenda semafori */}
      <LegendBox>
        <div className="font-semibold text-gray-600 mb-1">Come leggere i dati:</div>
        <div className="flex flex-col gap-0.5">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle" />Verde = situazione positiva, nessun intervento urgente</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1.5 align-middle" />Giallo = area di attenzione, intervento consigliato</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle" />Rosso = area critica, intervento prioritario</span>
        </div>
        <div className="mt-1.5 text-gray-400">
          Livello 1: % dipendenti con disturbi che impattano le attività (candidati al trattamento) ·
          Livello 2: dolore presente senza impatto funzionale (monitoraggio) ·
          Livello 3: nessun disturbo in atto (formazione).
        </div>
      </LegendBox>

      {/* NMQ */}
      <SectionTitle>Disturbi muscolo-scheletrici per zona — 12 mesi</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 print-page">
        {nmq.zones.map((z, i) => (
          <HBar key={i} label={z.zone} value={z.pct12} />
        ))}
        <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
          Prevalenza: <strong>{nmq.prevalence.count}</strong> dip. ({nmq.prevalence.pct}%) con almeno 1 disturbo negli ultimi 12 mesi
        </div>
      </div>

      {/* Suddivisione per ruolo dentro la sezione NMQ */}
      {(nmq.byRole.production.n > 0 && nmq.byRole.office.n > 0) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 print-page">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Suddivisione per tipologia di lavoro</div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '🏭 In produzione', data: nmq.byRole.production },
              { label: '💻 In ufficio', data: nmq.byRole.office },
            ].map(({ label, data }) => (
              <div key={label}>
                <div className="text-xs font-semibold text-gray-600 mb-2">
                  {label} <span className="font-normal text-gray-400">({data.n} risp.)</span>
                </div>
                {data.n < 5 ? (
                  <div className="text-xs text-gray-400 italic">Dati insufficienti (&lt;5 risposte)</div>
                ) : (
                  data.zones.slice(0, 7).map((z, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1">
                      <div className="w-20 text-xs text-gray-500 truncate text-right flex-shrink-0">{z.zone}</div>
                      <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${z.pct12}%`,
                            background: z.pct12 > 50 ? '#dc2626' : z.pct12 > 30 ? '#ca8a04' : '#16a34a',
                            minWidth: z.pct12 > 0 ? 16 : 0,
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 w-8 flex-shrink-0">{z.pct12}%</div>
                    </div>
                  ))
                )}
                {data.n >= 5 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                    <span className="text-red-600 font-semibold">L1: {data.level1.count}</span>
                    <span className="text-gray-400 ml-1">({data.level1.pct}%)</span>
                    <span className="text-yellow-600 font-semibold ml-2">L2: {data.level2.count}</span>
                    <span className="text-gray-400 ml-1">({data.level2.pct}%)</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3 livelli */}
      <SectionTitle>Stratificazione popolazione — 3 livelli</SectionTitle>
      <LevelBoxes nmq={nmq} />

      {/* Legenda livelli — criteri v4 */}
      <LegendBox>
        <div className="font-semibold text-gray-600 mb-1">Come si determinano i livelli:</div>
        <div className="mb-0.5"><strong className="text-red-600">Livello 1 (Trattamento):</strong> dipendenti con dolore in atto (ultimi 7 giorni) che ha limitato o impedito le normali attività. Necessitano di trattamento osteopatico individuale.</div>
        <div className="mb-0.5"><strong className="text-yellow-600">Livello 2 (Monitoraggio):</strong> dipendenti con dolore in atto ma senza impatto funzionale. Candidati alla prevenzione attiva e al self-trigger.</div>
        <div><strong className="text-green-600">Livello 3 (Formazione):</strong> dipendenti senza dolore in atto. Partecipano alla formazione collettiva su postura ed ergonomia insieme a tutti gli altri.</div>
      </LegendBox>

      {/* NMQ Comparison */}
      {hasBaseline && baseNmq && (
        <>
          <SectionTitle>Confronto MSDs — Baseline vs Attuale</SectionTitle>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 print-page">
            {nmq.zones.slice(0, 6).map((z, i) => {
              const bz = baseNmq.zones.find(b => b.zone === z.zone);
              return bz ? <CompareBar key={i} label={z.zone} before={bz.pct12} after={z.pct12} /> : null;
            })}
          </div>
        </>
      )}

      {/* Baseline comparison summary */}
      {hasBaseline && (
        <>
          <SectionTitle>Variazioni rispetto alla baseline</SectionTitle>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-3 print-page">
            <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-700">
              <div>
                L1 (impatto funzionale): <strong>{baseNmq.level1.pct}%</strong> → <strong>{nmq.level1.pct}%</strong>
                <Delta before={baseNmq.level1.pct} after={nmq.level1.pct} inverse />
              </div>
              <div>
                L2 (monitoraggio): <strong>{baseNmq.level2.pct}%</strong> → <strong>{nmq.level2.pct}%</strong>
                <Delta before={baseNmq.level2.pct} after={nmq.level2.pct} inverse />
              </div>
              <div>
                Prevalenza 12 mesi: <strong>{baseNmq.prevalence.pct}%</strong> → <strong>{nmq.prevalence.pct}%</strong>
                <Delta before={baseNmq.prevalence.pct} after={nmq.prevalence.pct} inverse />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mod 2: Matrice migrazione livelli (solo per final con baseline) */}
      {assessment.type === 'final' && hasBaseline && baseNmq && (
        <>
          <SectionTitle>Migrazione tra livelli — Baseline vs Finale</SectionTitle>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 print-page">
            <div className="text-xs text-gray-500 mb-3">
              Variazione nella distribuzione della popolazione tra i 3 livelli di rischio.
            </div>
            {[
              { label: 'Livello 1 (Trattamento)', before: baseNmq.level1.count, after: nmq.level1.count, beforePct: baseNmq.level1.pct, afterPct: nmq.level1.pct, color: '#E74C3C', inverse: true },
              { label: 'Livello 2 (Prevenzione)', before: baseNmq.level2.count, after: nmq.level2.count, beforePct: baseNmq.level2.pct, afterPct: nmq.level2.pct, color: '#F39C12', inverse: true },
              { label: 'Livello 3 (Solo formazione)', before: baseNmq.level3.count, after: nmq.level3.count, beforePct: baseNmq.level3.pct, afterPct: nmq.level3.pct, color: '#16a34a', inverse: false },
            ].map((row, i) => {
              const diff = row.after - row.before;
              const good = row.inverse ? diff < 0 : diff > 0;
              const neutral = diff === 0;
              return (
                <div key={i} className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: row.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 mb-1">{row.label}</div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">{row.before} ({row.beforePct}%)</span>
                      <span className="text-gray-300">→</span>
                      <span className="font-semibold" style={{ color: row.color }}>{row.after} ({row.afterPct}%)</span>
                      {!neutral && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${good ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {diff > 0 ? '+' : ''}{diff} {good ? '↓' : '↑'}
                        </span>
                      )}
                      {neutral && <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">stabile</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="text-xs text-gray-400 pt-2 mt-1">
              Per Livello 1 e 2: verde = riduzione (miglioramento). Per Livello 3: verde = aumento.
            </div>
          </div>
        </>
      )}

      {/* Commento discorsivo AI — integrato nel report dati (un solo report) */}
      {assessment.type === 'initial' && client?.id && (
        <AiCommentSection clientId={client.id} initialText={aiInitialText} />
      )}

      {/* Genera preventivo button */}
      {assessment.type === 'initial' && onOpenCalculator && (
        <div className="mt-6 mb-3 no-print">
          <button
            onClick={onOpenCalculator}
            className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-semibold text-base hover:bg-green-700 transition-colors"
          >
            Genera preventivo →
          </button>
        </div>
      )}

      {/* Mod 13: Footer con copyright */}
      <ReportFooter />
    </div>
  );
}
