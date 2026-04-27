import {
  aggregateNMQ, aggregatePSS, aggregateUWES, aggregateENPS,
  trafficLight, TL_COLOR, TL_BG, TL_BORDER,
  TYPE_LABELS, generateSummaryText,
} from '../lib/scoring';

// ─── Semaphore ────────────────────────────────────────────────────────────────

function Semaphore({ type, value, label, subtitle }) {
  const color = trafficLight(type, value);
  return (
    <div
      className="rounded-2xl p-4 text-center print-page"
      style={{ background: TL_BG[color], border: `1px solid ${TL_BORDER[color]}` }}
    >
      <div
        className="w-3 h-3 rounded-full mx-auto mb-2"
        style={{ background: TL_COLOR[color], boxShadow: `0 0 8px ${TL_COLOR[color]}80` }}
      />
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: TL_COLOR[color] }}>{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function HBar({ label, value, max = 100 }) {
  const color = value > 50 ? '#dc2626' : value > 30 ? '#ca8a04' : '#16a34a';
  const pct = Math.max((value / max) * 100, value > 0 ? 5 : 0);
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-36 text-xs text-gray-500 text-right flex-shrink-0 truncate">{label}</div>
      <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full rounded flex items-center justify-end pr-2 text-white text-xs font-medium transition-all duration-500"
          style={{ width: `${pct}%`, background: color, minWidth: value > 0 ? 32 : 0 }}
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
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-6">
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReportView({ assessment, client, baseline }) {
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
  const pss = assessment.include_pss ? aggregatePSS(responseList) : null;
  const uwes = aggregateUWES(responseList);
  const enps = aggregateENPS(responseList);

  const baseResp = baseline?.responseList || [];
  const baseNmq = baseResp.length > 0 ? aggregateNMQ(baseResp) : null;
  const basePss = baseline?.include_pss && baseResp.length > 0 ? aggregatePSS(baseResp) : null;
  const baseUwes = baseResp.length > 0 ? aggregateUWES(baseResp) : null;
  const baseEnps = baseResp.length > 0 ? aggregateENPS(baseResp) : null;
  const hasBaseline = !!baseNmq;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-10" id="report-root">
      {/* Header */}
      <div className="flex items-end justify-between py-5 border-b-2 border-green-600 mb-6">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            ES <span className="text-green-600">Work</span>
          </div>
          <div className="text-sm text-gray-500 mt-0.5">{TYPE_LABELS[assessment.type]}</div>
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

      {/* Auto-generated summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-2 print-page">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Sintesi automatica</div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {generateSummaryText(nmq, pss, uwes, enps)}
        </p>
      </div>

      {/* KPI Dashboard */}
      <SectionTitle>Cruscotto sintetico</SectionTitle>
      <div className={`grid gap-3 mb-2 ${pss ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <Semaphore type="nmq" value={`${nmq.pct}%`} label="Salute fisica" subtitle="con disturbi MSDs" />
        {pss && <Semaphore type="pss" value={pss.mean} label="Stress (PSS-10)" subtitle="score medio" />}
        <Semaphore type="uwes" value={uwes.mean} label="Engagement" subtitle="UWES-9 medio" />
        <Semaphore type="enps" value={`${enps.score > 0 ? '+' : ''}${enps.score}`} label="Clima (eNPS)" subtitle="" />
      </div>

      {/* NMQ */}
      <SectionTitle>Disturbi muscolo-scheletrici per zona — 12 mesi</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 print-page">
        {nmq.zones.map((z, i) => (
          <HBar key={i} label={z.zone} value={z.pct12} />
        ))}
        <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
          Popolazione sintomatica: <strong>{nmq.symptomatic}</strong> dipendenti ({nmq.pct}%) con almeno 1 zona con disturbi
        </div>
      </div>

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

      {/* PSS */}
      {pss && (
        <>
          <SectionTitle>Distribuzione stress percepito (PSS-10)</SectionTitle>
          <div className="grid grid-cols-3 gap-3 mb-3 print-page">
            <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-100">
              <div className="text-3xl font-bold text-green-600">{pss.low}%</div>
              <div className="text-xs text-green-700 mt-1">Stress basso</div>
              <div className="text-xs text-gray-400">≤13</div>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-4 text-center border border-yellow-100">
              <div className="text-3xl font-bold text-yellow-600">{pss.mod}%</div>
              <div className="text-xs text-yellow-700 mt-1">Moderato</div>
              <div className="text-xs text-gray-400">14–26</div>
            </div>
            <div className="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
              <div className="text-3xl font-bold text-red-600">{pss.high}%</div>
              <div className="text-xs text-red-700 mt-1">Stress elevato</div>
              <div className="text-xs text-gray-400">≥27</div>
            </div>
          </div>
        </>
      )}

      {/* UWES */}
      <SectionTitle>Engagement lavorativo (UWES-9)</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 print-page">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { l: 'Vigore', v: uwes.vigore },
            { l: 'Dedizione', v: uwes.dedizione },
            { l: 'Assorbimento', v: uwes.assorbimento },
          ].map(d => (
            <div key={d.l} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{d.l}</div>
              <div className="text-2xl font-bold text-blue-600">{d.v}</div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded transition-all duration-500"
                  style={{ width: `${(d.v / 6) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 pt-3 border-t border-gray-100 text-center">
          Score globale UWES-9: <strong className="text-blue-600 text-sm">{uwes.mean}</strong> / 6
        </div>
      </div>

      {/* eNPS */}
      <SectionTitle>Clima aziendale — eNPS</SectionTitle>
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 print-page">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="text-4xl font-bold" style={{
            color: enps.score >= 20 ? '#16a34a' : enps.score >= 0 ? '#ca8a04' : '#dc2626'
          }}>
            {enps.score > 0 ? '+' : ''}{enps.score}
          </div>
          <div className="text-sm text-gray-500">eNPS</div>
        </div>
        <div className="flex h-6 rounded-full overflow-hidden">
          {enps.promoters > 0 && (
            <div
              className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${enps.promoters}%` }}
            >
              {enps.promoters}%
            </div>
          )}
          {enps.passives > 0 && (
            <div
              className="bg-yellow-400 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${enps.passives}%` }}
            >
              {enps.passives}%
            </div>
          )}
          {enps.detractors > 0 && (
            <div
              className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${enps.detractors}%` }}
            >
              {enps.detractors}%
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5 px-0.5">
          <span>Promotori (9-10)</span>
          <span>Passivi (7-8)</span>
          <span>Detrattori (0-6)</span>
        </div>
      </div>

      {/* Baseline comparison summary */}
      {hasBaseline && (
        <>
          <SectionTitle>Variazioni rispetto alla baseline</SectionTitle>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-3 print-page">
            <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-700">
              <div>
                MSDs: <strong>{baseNmq.pct}%</strong> → <strong>{nmq.pct}%</strong>
                <Delta before={baseNmq.pct} after={nmq.pct} inverse />
              </div>
              {pss && basePss && (
                <div>
                  Stress: <strong>{basePss.mean}</strong> → <strong>{pss.mean}</strong>
                  <Delta before={basePss.mean} after={pss.mean} inverse />
                </div>
              )}
              {baseUwes && (
                <div>
                  Engagement: <strong>{baseUwes.mean}</strong> → <strong>{uwes.mean}</strong>
                  <Delta before={baseUwes.mean} after={uwes.mean} />
                </div>
              )}
              {baseEnps && (
                <div>
                  eNPS: <strong>{baseEnps.score}</strong> → <strong>{enps.score}</strong>
                  <Delta before={baseEnps.score} after={enps.score} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 mt-8 pt-4 border-t border-gray-200">
        ES Work by Essentia Salutis — Report generato automaticamente
      </div>
    </div>
  );
}
