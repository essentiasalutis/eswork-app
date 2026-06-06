import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getClientById } from '../../lib/store';
import { calculatePricing, calculateROI, getTier, tierIncludesL2Prevention, fmt } from '../../lib/calculator';
import { CONFIG } from '../../lib/config';
import NavMenu from '../../components/NavMenu';

const TIER_LABELS = { core: 'Core', plus: 'Plus', enterprise: 'Enterprise' };
const TIER_COLORS = { core: '#6b7280', plus: '#2563eb', enterprise: '#7c3aed' };
const SECTORS = [['services', 'Servizi / Uffici'], ['manufacturing', 'Manifattura'], ['mix', 'Mix']];
const FATTURATO = [['low', '< 2 M€'], ['mid', '2–10 M€'], ['high', '> 10 M€']];
const HR = [['low', 'Bassa'], ['medium', 'Media'], ['high', 'Alta']];
const fatturatoNum = b => (b === 'high' ? 11e6 : b === 'mid' ? 5e6 : 1e6);

function ScenarioCard({ label, l1, l2, calc, active, onClick }) {
  if (!calc) return null;
  return (
    <button onClick={onClick} className={`flex-1 rounded-2xl border-2 p-3 text-left transition-all ${active ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 ${active ? 'text-green-700' : 'text-gray-400'}`}>{label}</div>
      <div className={`text-xl font-bold ${active ? 'text-green-700' : 'text-gray-800'}`}>{fmt(calc.price_y1)}</div>
      <div className="text-[11px] text-gray-500 mt-1">{l1} L1 · {l2} L2</div>
    </button>
  );
}

export default function CalculatorPage({ client, prefill }) {
  const router = useRouter();

  // ─── Input colloquio ──────────────────────────────────────────────────────
  const [sedi, setSedi] = useState(() => [prefill?.n || 100]);
  const [sector, setSector] = useState('services');
  const [fatturato, setFatturato] = useState('mid');
  const [hrMaturity, setHrMaturity] = useState('medium');
  const [capacity, setCapacity] = useState(CONFIG.classroom_capacity_default);
  const [trainingMode, setTrainingMode] = useState('per_sede'); // per_sede | accorpa
  const [absenceDays, setAbsenceDays] = useState('');

  // ─── Parametri preventivo (editabili) ──────────────────────────────────────
  const [legacy, setLegacy] = useState(false);
  const [rates, setRates] = useState({ ...CONFIG.rates_new });
  const [l2Mult, setL2Mult] = useState(CONFIG.l2_multiplier_default);
  const [vatExempt, setVatExempt] = useState(CONFIG.vat_exempt);
  const [showParams, setShowParams] = useState(false);
  const [showDetail, setShowDetail] = useState(true);

  // ─── Tier / override ────────────────────────────────────────────────────────
  const [tierOverride, setTierOverride] = useState(null);
  const [scenario, setScenario] = useState('avg');

  const n = useMemo(() => sedi.reduce((s, e) => s + (parseInt(e) || 0), 0), [sedi]);
  const suggestedTier = useMemo(() => getTier(n, { fatturato: fatturatoNum(fatturato), hrMaturity }), [n, fatturato, hrMaturity]);
  const tier = tierOverride || suggestedTier;

  const groups = useMemo(() => {
    const cap = Math.max(1, parseInt(capacity) || 25);
    if (trainingMode === 'accorpa') return Math.max(1, Math.ceil(n / cap));
    return sedi.reduce((s, e) => s + Math.ceil((parseInt(e) || 0) / cap), 0) || 1;
  }, [sedi, capacity, trainingMode, n]);

  const prev = CONFIG.l1_prevalence[sector] || [0.08, 0.13, 0.19];
  const scen = useMemo(() => {
    const mk = p => { const l1 = Math.round(n * p); return { l1, l2: Math.round(l1 * l2Mult) }; };
    return { min: mk(prev[0]), avg: mk(prev[1]), max: mk(prev[2]) };
  }, [n, prev, l2Mult]);

  function priceFor(s) {
    return n > 0 ? calculatePricing({ n, l1: s.l1, l2: s.l2, tier, groups, rates, vatExempt }) : null;
  }
  const calcMin = useMemo(() => priceFor(scen.min), [scen, tier, groups, rates, vatExempt, n]);
  const calcAvg = useMemo(() => priceFor(scen.avg), [scen, tier, groups, rates, vatExempt, n]);
  const calcMax = useMemo(() => priceFor(scen.max), [scen, tier, groups, rates, vatExempt, n]);
  const calc = scenario === 'min' ? calcMin : scenario === 'max' ? calcMax : calcAvg;
  const sel = scenario === 'min' ? scen.min : scenario === 'max' ? scen.max : scen.avg;

  const roi = useMemo(() => calc ? calculateROI(calc.price_y1, parseInt(absenceDays) || 0) : null, [calc, absenceDays]);

  function applyLegacy(v) {
    setLegacy(v);
    setRates({ ...(v ? CONFIG.rates_legacy : CONFIG.rates_new) });
  }
  function setRate(k, val) { setRates(r => ({ ...r, [k]: parseFloat(val) || 0 })); }
  function setSede(i, val) { setSedi(s => s.map((e, j) => j === i ? (val === '' ? '' : Math.max(0, parseInt(val) || 0)) : e)); }
  function addSede() { setSedi(s => [...s, 0]); }
  function removeSede(i) { setSedi(s => s.length > 1 ? s.filter((_, j) => j !== i) : s); }

  function goToOffer() {
    const params = new URLSearchParams({
      assessmentId: prefill?.assessmentId || '',
      n: String(n), l1: String(sel.l1), l2: String(sel.l2),
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

  const Row = ({ label, detail, value, strong }) => (
    <tr className={strong ? 'border-t-2 border-gray-200' : 'border-b border-gray-50'}>
      <td className={`py-2 ${strong ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
        {label}{detail && <span className="block text-[11px] text-gray-400">{detail}</span>}
      </td>
      <td className={`py-2 text-right ${strong ? 'font-bold text-green-700' : 'font-medium text-gray-700'}`}>{value}</td>
    </tr>
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
            <div className="font-semibold text-gray-900">Nuovo cliente / Preventivo</div>
            {client && <div className="text-xs text-gray-500">{client.name}</div>}
          </div>
          {calc && (
            <button onClick={goToOffer} className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-700">
              Genera offerta →
            </button>
          )}
          <NavMenu />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-5 space-y-4">

        {/* Dati azienda */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dati azienda</div>

          {/* Sedi */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1.5">Sedi e dipendenti</label>
            <div className="space-y-2">
              {sedi.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14">Sede {i + 1}</span>
                  <input type="number" min="0" value={e} onChange={ev => setSede(i, ev.target.value)} className={inputCls + ' flex-1'} />
                  {sedi.length > 1 && (
                    <button onClick={() => removeSede(i)} className="text-gray-400 hover:text-red-500 px-2 text-lg">×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addSede} className="mt-2 text-xs font-semibold text-green-700 hover:text-green-800">+ Aggiungi sede</button>
            <div className="text-xs text-gray-400 mt-1">Totale dipendenti: <strong className="text-gray-600">{n}</strong></div>
          </div>

          {/* Tier */}
          {n > 0 && (
            <div className="flex items-center flex-wrap gap-2 text-sm">
              <span className="text-gray-500">Tier interno:</span>
              <span className="font-bold px-3 py-1 rounded-full text-white text-xs" style={{ background: TIER_COLORS[tier] }}>{TIER_LABELS[tier]}</span>
              {tierOverride && <span className="text-[11px] text-amber-600">(override · suggerito {TIER_LABELS[suggestedTier]})</span>}
              <div className="flex gap-1 ml-auto">
                {['core', 'plus', 'enterprise'].map(t => (
                  <button key={t} onClick={() => setTierOverride(t === suggestedTier ? null : t)}
                    className={`text-[11px] px-2 py-1 rounded-lg ${tier === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>{TIER_LABELS[t]}</button>
                ))}
              </div>
            </div>
          )}

          {/* Settore */}
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-2">Settore <span className="text-gray-400 font-normal">(prevalenza L1)</span></label>
            <div className="flex gap-2">{SECTORS.map(([v, l]) => segBtn(v, sector, setSector, l))}</div>
          </div>

          {/* Fatturato + HR (criteri tier) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Fatturato</label>
              <div className="flex gap-1">{FATTURATO.map(([v, l]) => segBtn(v, fatturato, setFatturato, l))}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Maturità HR</label>
              <div className="flex gap-1">{HR.map(([v, l]) => segBtn(v, hrMaturity, setHrMaturity, l))}</div>
            </div>
          </div>

          {/* Formazione */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">Capienza aula</label>
              <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Formazione</label>
              <div className="flex gap-1">
                {segBtn('per_sede', trainingMode, setTrainingMode, 'Per sede')}
                {segBtn('accorpa', trainingMode, setTrainingMode, 'Accorpa')}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400">Gruppi formazione stimati: <strong className="text-gray-600">{groups}</strong></div>
        </div>

        {/* Parametri preventivo (editabili) */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button onClick={() => setShowParams(v => !v)} className="w-full flex items-center justify-between px-5 py-4">
            <span className="text-sm font-semibold text-gray-700">⚙️ Parametri preventivo</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showParams ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showParams && (
            <div className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tariffe cliente storico</span>
                <button onClick={() => applyLegacy(!legacy)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${legacy ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{legacy ? '✓ Storico' : 'Nuovo cliente'}</button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['sportello_sell', 'Sportello €/h (vend.)'], ['sportello_cost', 'Sportello €/h (costo)'],
                  ['prevalidation_sell', 'Pre-valid. € (vend.)'], ['prevalidation_cost', 'Pre-valid. € (costo)'],
                  ['training_sell', 'Formazione €/mod (vend.)'], ['training_cost', 'Formazione €/mod (costo)'],
                ].map(([k, l]) => (
                  <div key={k}>
                    <label className="text-[11px] text-gray-500 block mb-1">{l}</label>
                    <input type="number" value={rates[k]} onChange={e => setRate(k, e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-[11px] text-gray-500 block mb-1">Moltiplicatore L2 <span className="text-gray-400">(stima da tarare)</span></label>
                  <input type="number" step="0.1" min="0" value={l2Mult} onChange={e => setL2Mult(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                  <input type="checkbox" checked={vatExempt} onChange={e => setVatExempt(e.target.checked)} className="w-4 h-4 accent-green-600" />
                  Esente IVA (forfettario)
                </label>
              </div>
              <div className="text-[11px] text-gray-400">Buffer fisso {Math.round(CONFIG.buffer_pct * 100)}% · L1 = {CONFIG.sessions_per_l1} sedute · prevenzione L2 {tierIncludesL2Prevention(tier) ? `${CONFIG.prevention_sessions_per_l2} sessioni (Plus/Enterprise)` : 'non prevista (Core)'}</div>
            </div>
          )}
        </div>

        {n > 0 && calc && (
          <>
            {/* Scenari */}
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Scenario di prevalenza — Anno 1</div>
              <div className="flex gap-2">
                <ScenarioCard label="Min" l1={scen.min.l1} l2={scen.min.l2} calc={calcMin} active={scenario === 'min'} onClick={() => setScenario('min')} />
                <ScenarioCard label="Medio" l1={scen.avg.l1} l2={scen.avg.l2} calc={calcAvg} active={scenario === 'avg'} onClick={() => setScenario('avg')} />
                <ScenarioCard label="Max" l1={scen.max.l1} l2={scen.max.l2} calc={calcMax} active={scenario === 'max'} onClick={() => setScenario('max')} />
              </div>
              <div className="text-[11px] text-gray-400 mt-2 text-center">
                Prevalenza L1 {sector === 'services' ? 'Servizi' : sector === 'manufacturing' ? 'Manifattura' : 'Mix'}: {prev.map(p => `${Math.round(p * 100)}%`).join(' / ')} · L2 ≈ {l2Mult}× L1
              </div>
            </div>

            {/* Anno 1 */}
            <div className="bg-green-600 rounded-2xl p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest mb-1 opacity-80">Investimento Anno 1 — scenario {scenario === 'min' ? 'min' : scenario === 'max' ? 'max' : 'medio'}</div>
              <div className="text-4xl font-bold mb-1">{fmt(calc.price_y1)}</div>
              <div className="text-sm opacity-90">{fmt(calc.price_monthly_y1)}/mese · {fmt(calc.price_per_employee_y1)}/dipendente · {sel.l1} L1{tierIncludesL2Prevention(tier) ? ` · ${sel.l2} L2 in prevenzione` : ''}</div>
              {!vatExempt && <div className="text-xs opacity-80 mt-1">+ IVA 22% = {fmt(calc.y1.total_with_vat)}</div>}
              {vatExempt && <div className="text-xs opacity-80 mt-1">Esente IVA (regime forfettario)</div>}
            </div>

            {/* Dettaglio voci Anno 1 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button onClick={() => setShowDetail(v => !v)} className="w-full flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold text-gray-700">Dettaglio voci — Anno 1</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDetail ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showDetail && (
                <div className="px-5 pb-4 border-t border-gray-100">
                  <table className="w-full text-sm">
                    <tbody>
                      {calc.y1.items.map((it, i) => (
                        <Row key={i} label={it.label} detail={it.detail} value={fmt(it.sell)} />
                      ))}
                      <Row label={`Buffer ${Math.round(calc.y1.buffer_pct * 100)}%`} detail="copre L2→L1, self-trigger, urgenze, 2° ciclo" value={fmt(calc.y1.buffer_sell)} />
                      <Row label="Totale Anno 1" value={fmt(calc.y1.total_sell)} strong />
                    </tbody>
                  </table>
                  <div className="text-[11px] text-gray-400 mt-2">Costo professionista Anno 1: {fmt(calc.y1.total_cost)} · margine {fmt(calc.y1.margin)} ({Math.round(calc.y1.margin / calc.y1.total_sell * 100)}%) — uso interno</div>
                </div>
              )}
            </div>

            {/* Anno 2+ */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Stima Anno 2+</div>
              <div className="text-3xl font-bold text-blue-700 mb-1">{fmt(calc.price_y2)}</div>
              <div className="text-sm text-blue-600">
                Formazione 1 modulo · nuovi L1 trattati{tierIncludesL2Prevention(tier) ? ` · L2 in prevenzione` : ''}. I L1 non migliorati dell’Anno 1 non rientrano nel calcolo.
              </div>
              <div className="text-[11px] text-blue-400 mt-1">Margine Anno 2+: {fmt(calc.y2.margin)} (uso interno)</div>
            </div>

            {/* Clausola di adeguamento */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
              <strong>Clausola di adeguamento (asimmetrica):</strong> il corrispettivo è confermato dopo l’assessment.
              Se i L1 reali sono ≤ scenario medio ({scen.avg.l1}) → resta al valore medio ({fmt(calcAvg.price_y1)}).
              Se superiori → sale fino al tetto massimo ({fmt(calcMax.price_y1)}); le sedute eccedenti il tetto sono gestite tramite il canale B2C/welfare.
            </div>

            {/* ROI */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">Giorni assenza malattia ultimi 12 mesi <span className="text-gray-400 font-normal">(opzionale, ROI)</span></label>
              <input type="number" min="0" value={absenceDays} onChange={e => setAbsenceDays(e.target.value)} placeholder="—" className={inputCls} />
            </div>
            {roi && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-700 space-y-2">
                <div className="flex justify-between"><span>Stima costo assenze attuale</span><span className="font-semibold">{fmt(roi.estimated_cost)}</span></div>
                <div className="flex justify-between"><span>Riduzione per break-even</span><span className="font-semibold text-amber-700">{roi.breakeven_pct}%</span></div>
                {roi.saving_15pct > 0 && <div className="p-3 bg-green-50 rounded-xl text-xs">Con −15% assenze: risparmio netto <strong className="text-green-700">{fmt(roi.saving_15pct)}</strong></div>}
              </div>
            )}

            <button onClick={goToOffer} className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base hover:bg-green-700 transition-colors">
              Genera offerta grafica →
            </button>
          </>
        )}

        {!n && <div className="text-center py-8 text-gray-400 text-sm">Inserisci i dipendenti per calcolare</div>}
      </main>
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  // Il calcolatore standalone è stato integrato nella Scheda colloquio (Step 2+4).
  // Reindirizza per non mantenere due percorsi.
  const { clientId } = ctx.query;
  return {
    redirect: {
      destination: clientId ? `/dashboard/first-meeting?clientId=${clientId}` : '/dashboard/first-meeting',
      permanent: false,
    },
  };
});
