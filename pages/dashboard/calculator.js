import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getClientById } from '../../lib/store';
import { calculatePricing, calculateROI, fmt } from '../../lib/calculator';
import { CONFIG } from '../../lib/config';

// ─── Prevalenze L1 per settore + tipo lavoro ──────────────────────────────────
const L1_PREV = {
  services: { vdt: [0.07, 0.10, 0.15], mixed: [0.09, 0.13, 0.18], manual: [0.11, 0.15, 0.22] },
  manufacturing: { vdt: [0.10, 0.14, 0.20], mixed: [0.12, 0.17, 0.24], manual: [0.15, 0.22, 0.30] },
  mix: { vdt: [0.08, 0.11, 0.17], mixed: [0.10, 0.15, 0.21], manual: [0.13, 0.18, 0.26] },
};
const L2_MULT = 2.2; // L2 stimati ≈ 2.2× L1 avg

function getTier(n) {
  if (n <= 150) return 'core';
  if (n <= 500) return 'plus';
  return 'enterprise';
}
const TIER_LABELS = { core: 'Core', plus: 'Plus', enterprise: 'Enterprise' };
const TIER_COLORS = { core: '#6b7280', plus: '#2563eb', enterprise: '#7c3aed' };

function ScenarioCard({ label, l1, l2, calc, color, active, onClick }) {
  if (!calc) return null;
  return (
    <button onClick={onClick} className={`flex-1 rounded-2xl border-2 p-4 text-left transition-all ${active ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${active ? 'text-green-700' : 'text-gray-400'}`}>{label}</div>
      <div className={`text-2xl font-bold ${active ? 'text-green-700' : 'text-gray-800'}`}>{fmt(calc.price_y1)}</div>
      <div className="text-xs text-gray-500 mt-1">{l1} L1 · {l2} L2</div>
      <div className="text-xs text-gray-400 mt-0.5">{fmt(calc.price_monthly_y1)}/mese</div>
    </button>
  );
}

export default function CalculatorPage({ client, prefill }) {
  const router = useRouter();

  // Input base
  const [n, setN] = useState(prefill?.n || 100);
  const [sector, setSector] = useState('services');
  const [workType, setWorkType] = useState('mixed');
  const [locations, setLocations] = useState(1);
  const [absenceDays, setAbsenceDays] = useState('');

  // Override manuale L1/L2
  const [manualOverride, setManualOverride] = useState(false);
  const [l1Manual, setL1Manual] = useState(prefill?.l1 ?? '');
  const [l2Manual, setL2Manual] = useState(prefill?.l2 ?? '');

  // Scenario selezionato (min/avg/max)
  const [scenario, setScenario] = useState('avg');

  const [showDetail, setShowDetail] = useState(false);

  const nv = parseInt(n) || 0;
  const tier = getTier(nv);

  // Stime automatiche L1 per scenario
  const { minL1, avgL1, maxL1 } = useMemo(() => {
    const prev = L1_PREV[sector]?.[workType] || [0.10, 0.14, 0.20];
    return {
      minL1: Math.round(nv * prev[0]),
      avgL1: Math.round(nv * prev[1]),
      maxL1: Math.round(nv * prev[2]),
    };
  }, [nv, sector, workType]);

  const { minL2, avgL2, maxL2 } = useMemo(() => ({
    minL2: Math.round(minL1 * L2_MULT * 0.7),
    avgL2: Math.round(avgL1 * L2_MULT),
    maxL2: Math.round(maxL1 * L2_MULT * 1.3),
  }), [minL1, avgL1, maxL1]);

  // L1/L2 effettivi
  const l1 = manualOverride ? (parseInt(l1Manual) || 0) : (scenario === 'min' ? minL1 : scenario === 'max' ? maxL1 : avgL1);
  const l2 = manualOverride ? (parseInt(l2Manual) || 0) : (scenario === 'min' ? minL2 : scenario === 'max' ? maxL2 : avgL2);

  // Calc per ogni scenario
  const calcMin = useMemo(() => nv > 0 ? calculatePricing(nv, minL1, minL2) : null, [nv, minL1, minL2]);
  const calcAvg = useMemo(() => nv > 0 ? calculatePricing(nv, avgL1, avgL2) : null, [nv, avgL1, avgL2]);
  const calcMax = useMemo(() => nv > 0 ? calculatePricing(nv, maxL1, maxL2) : null, [nv, maxL1, maxL2]);
  const calc = useMemo(() => nv > 0 ? calculatePricing(nv, l1, l2) : null, [nv, l1, l2]);

  const roi = useMemo(() => {
    if (!calc) return null;
    const days = parseInt(absenceDays) || 0;
    return calculateROI(calc.price_y1, days);
  }, [calc, absenceDays]);

  // Giornate sportello multi-sede
  const daysPerSede = calc ? Math.ceil(calc.days_osteo_y1 / Math.max(1, locations)) : 0;

  // Pre-validazioni stimate
  const prevalCount = Math.ceil(l1 / 3);

  function goToOffer() {
    const params = new URLSearchParams({
      assessmentId: prefill?.assessmentId || '',
      n, l1, l2,
      ...(client ? { clientId: client.id } : {}),
    });
    router.push(`/dashboard/offer?${params}`);
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';
  const segBtn = (val, cur, setter, label) => (
    <button key={val} onClick={() => setter(val)}
      className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${cur === val ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900">Calcolatore preventivo</div>
            {client && <div className="text-xs text-gray-500">{client.name}</div>}
          </div>
          {calc && (
            <button onClick={goToOffer} className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700">
              Genera offerta →
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-5 space-y-4">

        {/* Dati azienda */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dati azienda</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">N. dipendenti</label>
              <input type="number" min="1" value={n} onChange={e => setN(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">N. sedi</label>
              <input type="number" min="1" max="20" value={locations} onChange={e => setLocations(Math.max(1, parseInt(e.target.value) || 1))} className={inputCls} />
            </div>
          </div>

          {/* Tier suggerito */}
          {nv > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Tier suggerito:</span>
              <span className="font-bold px-3 py-1 rounded-full text-white text-xs" style={{ background: TIER_COLORS[tier] }}>
                {TIER_LABELS[tier]}
              </span>
              <span className="text-gray-400 text-xs">
                {tier === 'core' ? '≤150 dip.' : tier === 'plus' ? '151-500 dip.' : '>500 dip.'}
              </span>
            </div>
          )}

          {/* Settore */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">Settore</label>
            <div className="flex gap-2">
              {[
                ['services', 'Servizi / Uffici'],
                ['manufacturing', 'Manifattura'],
                ['mix', 'Mix'],
              ].map(([val, label]) => segBtn(val, sector, setSector, label))}
            </div>
          </div>

          {/* Tipo lavoro */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">Tipo di lavoro prevalente</label>
            <div className="flex gap-2">
              {[
                ['vdt', 'VDT / Scrivania'],
                ['mixed', 'Misto'],
                ['manual', 'Prevalente manuale'],
              ].map(([val, label]) => segBtn(val, workType, setWorkType, label))}
            </div>
          </div>
        </div>

        {nv > 0 && (
          <>
            {/* Scenari min/avg/max */}
            {!manualOverride && (
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Scenario di prevalenza</div>
                <div className="flex gap-2">
                  <ScenarioCard label="Ottimistico" l1={minL1} l2={minL2} calc={calcMin} active={scenario === 'min'} onClick={() => setScenario('min')} />
                  <ScenarioCard label="Medio (raccomandato)" l1={avgL1} l2={avgL2} calc={calcAvg} active={scenario === 'avg'} onClick={() => setScenario('avg')} />
                  <ScenarioCard label="Conservativo" l1={maxL1} l2={maxL2} calc={calcMax} active={scenario === 'max'} onClick={() => setScenario('max')} />
                </div>
                <div className="text-xs text-gray-400 mt-2 text-center">
                  Prevalenza L1 stimata dal settore ({sector === 'services' ? 'Servizi' : sector === 'manufacturing' ? 'Manifattura' : 'Mix'}) + tipo lavoro
                </div>
              </div>
            )}

            {/* Override manuale */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-gray-700">Override manuale L1/L2</div>
                <button onClick={() => setManualOverride(v => !v)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${manualOverride ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {manualOverride ? '✓ Attivo' : 'Attiva'}
                </button>
              </div>
              {manualOverride && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Livello 1 (trattamento)</label>
                    <input type="number" min="0" value={l1Manual} onChange={e => setL1Manual(e.target.value)} placeholder={String(avgL1)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Livello 2 (monitoraggio)</label>
                    <input type="number" min="0" value={l2Manual} onChange={e => setL2Manual(e.target.value)} placeholder={String(avgL2)} className={inputCls} />
                  </div>
                </div>
              )}
              {!manualOverride && (
                <div className="grid grid-cols-3 gap-2 text-sm text-center">
                  <div className="bg-gray-50 rounded-xl p-2">
                    <div className="font-bold text-blue-700">{l1}</div>
                    <div className="text-xs text-gray-400">L1 stimati</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2">
                    <div className="font-bold text-amber-700">{l2}</div>
                    <div className="text-xs text-gray-400">L2 stimati</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2">
                    <div className="font-bold text-gray-700">{prevalCount}</div>
                    <div className="text-xs text-gray-400">Pre-validazioni</div>
                  </div>
                </div>
              )}
            </div>

            {calc && (
              <>
                {/* Anno 1 */}
                <div className="bg-green-600 rounded-2xl p-5 text-white">
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1 opacity-80">
                    Investimento Anno 1 — {TIER_LABELS[tier]}
                  </div>
                  <div className="text-4xl font-bold mb-1">{fmt(calc.price_y1)}</div>
                  <div className="text-sm opacity-90">
                    {fmt(calc.price_monthly_y1)}/mese · {fmt(calc.price_per_employee_y1)}/dipendente
                  </div>
                </div>

                {/* Giornate sportello */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Giornate sportello</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-blue-50 rounded-xl p-3">
                      <div className="text-2xl font-bold text-blue-700">{calc.days_osteo_y1}</div>
                      <div className="text-xs text-gray-500 mt-1">Giornate totali Anno 1</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-2xl font-bold text-gray-700">{locations}</div>
                      <div className="text-xs text-gray-500 mt-1">Sede{locations > 1 ? 'i' : ''}</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3">
                      <div className="text-2xl font-bold text-green-700">{daysPerSede}</div>
                      <div className="text-xs text-gray-500 mt-1">Gg/sede</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2 text-center">
                    {calc.sessions_y1_base} sess. base + {calc.buffer_sessions} buffer (15%) = {Math.round(calc.sessions_y1_base + calc.buffer_sessions)} totali · 14 slot/giornata
                  </div>
                </div>

                {/* Dettaglio costi */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setShowDetail(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left">
                    <span className="text-sm font-semibold text-gray-700">Dettaglio costi Anno 1</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDetail ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showDetail && (
                    <div className="px-5 pb-4 border-t border-gray-100">
                      <table className="w-full text-sm">
                        <tbody>
                          {[
                            [`Giornate osteopatiche (${calc.days_osteo_y1} gg, include +${Math.round(calc.buffer_hours)}h buffer)`, calc.cost_osteo_y1],
                            [`Formazione (${calc.training_sessions_y1} sess., ${calc.groups} gruppi)`, calc.cost_training_y1],
                            ['Assessment iniziale + report attivazione', CONFIG.cost_initial_assessment],
                            ['Assessment finale + report annuale', CONFIG.cost_final_assessment + CONFIG.cost_annual_report],
                            ['2 review + report semestrale', calc.cost_reviews_y1],
                          ].map(([label, cost], i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2 text-gray-600">{label}</td>
                              <td className="py-2 text-right font-medium text-gray-700">{fmt(cost)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-200">
                            <td className="py-2 font-semibold text-gray-700">Totale costi</td>
                            <td className="py-2 text-right font-semibold text-gray-700">{fmt(calc.total_cost_y1)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-bold text-green-700">Prezzo (margine {Math.round(CONFIG.margin_y1 * 100)}%)</td>
                            <td className="py-2 text-right font-bold text-green-700">{fmt(calc.price_y1)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Anno 2 */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Stima Anno 2+</div>
                  <div className="text-3xl font-bold text-blue-700 mb-1">{fmt(calc.price_y2)}</div>
                  <div className="text-sm text-blue-600">
                    {calc.pop_y2} dipendenti · mantenimento L1 + prevenzione L2
                    {tier !== 'core' && <span className="ml-1">· L2 inclusi (tier {TIER_LABELS[tier]})</span>}
                  </div>
                </div>

                {/* ROI */}
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1.5">
                    Giorni assenza malattia ultimi 12 mesi <span className="text-gray-400 font-normal">(opzionale, per ROI)</span>
                  </label>
                  <input type="number" min="0" value={absenceDays} onChange={e => setAbsenceDays(e.target.value)} placeholder="—" className={inputCls} />
                </div>

                {roi && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Analisi ROI</div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span>Stima costo assenze attuale</span><span className="font-semibold">{fmt(roi.estimated_cost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Riduzione necessaria per break-even</span><span className="font-semibold text-amber-700">{roi.breakeven_pct}%</span>
                      </div>
                      {roi.saving_15pct > 0 && (
                        <div className="mt-2 p-3 bg-white rounded-xl text-xs text-gray-600">
                          Con una riduzione del 15% delle assenze, risparmio netto <strong className="text-green-700">{fmt(roi.saving_15pct)}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <button onClick={goToOffer} className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base hover:bg-green-700 transition-colors">
                  Genera offerta grafica →
                </button>
              </>
            )}
          </>
        )}

        {!nv && (
          <div className="text-center py-8 text-gray-400 text-sm">Inserisci il numero di dipendenti per calcolare</div>
        )}
      </main>
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { clientId, assessmentId, n, l1, l2 } = ctx.query;
  let client = null;
  if (clientId) client = await getClientById(clientId).catch(() => null);
  return {
    props: {
      client: client || null,
      prefill: {
        assessmentId: assessmentId || null,
        n: n ? parseInt(n) : (client?.employees || 100),
        l1: l1 !== undefined ? parseInt(l1) : null,
        l2: l2 !== undefined ? parseInt(l2) : null,
      },
    },
  };
});
