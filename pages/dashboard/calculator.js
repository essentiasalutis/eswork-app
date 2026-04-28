import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getClientById } from '../../lib/store';
import { calculatePricing, calculateROI, fmt } from '../../lib/calculator';
import { CONFIG } from '../../lib/config';

export default function CalculatorPage({ client, prefill }) {
  const router = useRouter();

  const [n, setN] = useState(prefill?.n || 50);
  const [l1, setL1] = useState(prefill?.l1 ?? '');
  const [l2, setL2] = useState(prefill?.l2 ?? '');
  const [absenceDays, setAbsenceDays] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  const calc = useMemo(() => {
    const nv = parseInt(n) || 0;
    const l1v = parseInt(l1) || 0;
    const l2v = parseInt(l2) || 0;
    return nv > 0 ? calculatePricing(nv, l1v, l2v) : null;
  }, [n, l1, l2]);

  const roi = useMemo(() => {
    if (!calc) return null;
    const days = parseInt(absenceDays) || 0;
    return calculateROI(calc.price_y1, days);
  }, [calc, absenceDays]);

  function goToOffer() {
    const params = new URLSearchParams({
      assessmentId: prefill?.assessmentId || '',
      n: n,
      l1: l1 || 0,
      l2: l2 || 0,
    });
    router.push(`/dashboard/offer?${params}`);
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
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
            <button
              onClick={goToOffer}
              className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl"
            >
              Genera offerta
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Dati input */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Dati</div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">N. dipendenti totali</label>
              <input type="number" min="1" value={n} onChange={e => setN(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">
                Livello 1 — da trattare
                <span className="text-gray-400 font-normal ml-1">(impatto funzionale o dolore diffuso)</span>
              </label>
              <input type="number" min="0" value={l1} onChange={e => setL1(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">
                Livello 2 — prevenzione Anno 2
                <span className="text-gray-400 font-normal ml-1">(segnali da monitorare)</span>
              </label>
              <input type="number" min="0" value={l2} onChange={e => setL2(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-sm text-gray-600 font-medium block mb-1">
                Giorni assenza malattia ultimi 12 mesi
                <span className="text-gray-400 font-normal ml-1">(opzionale, per ROI)</span>
              </label>
              <input type="number" min="0" value={absenceDays} onChange={e => setAbsenceDays(e.target.value)} placeholder="—" className={inputCls} />
            </div>
          </div>
        </div>

        {!calc && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Inserisci il numero di dipendenti per calcolare il preventivo
          </div>
        )}

        {calc && (
          <>
            {/* Anno 1 */}
            <div className="bg-green-600 rounded-2xl p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-widest mb-1 opacity-80">Investimento Anno 1</div>
              <div className="text-4xl font-bold mb-1">{fmt(calc.price_y1)}</div>
              <div className="text-sm opacity-90">
                {fmt(calc.price_monthly_y1)}/mese · {fmt(calc.price_per_employee_y1)}/dipendente
              </div>
            </div>

            {/* Dettaglio costi */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowDetail(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
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
                        [`Giornate osteopatiche (${calc.days_osteo_y1} gg)`, calc.cost_osteo_y1],
                        [`Formazione (${calc.training_sessions_y1} sessioni, ${calc.groups} gruppi)`, calc.cost_training_y1],
                        ['Assessment iniziale + report attivazione', CONFIG.cost_initial_assessment],
                        ['Assessment finale + report annuale', CONFIG.cost_final_assessment + CONFIG.cost_annual_report],
                        ['2 review + report semestrale', calc.cost_reviews_y1],
                      ].map(([label, cost], i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 text-gray-600">{label}</td>
                          <td className="py-2 text-right text-gray-700 font-medium">{fmt(cost)}</td>
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
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Stima Anno 2+</div>
              <div className="text-3xl font-bold text-blue-700 mb-1">{fmt(calc.price_y2)}</div>
              <div className="text-sm text-blue-600">
                Estensione a {calc.pop_y2} dipendenti (mantenimento + prevenzione)
              </div>
            </div>

            {/* ROI */}
            {roi && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3">Analisi ROI</div>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span>Stima costo assenze attuale</span>
                    <span className="font-semibold">{fmt(roi.estimated_cost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Riduzione necessaria per break-even</span>
                    <span className="font-semibold text-amber-700">{roi.breakeven_pct}%</span>
                  </div>
                  {roi.saving_15pct > 0 && (
                    <div className="mt-2 p-3 bg-white rounded-xl text-xs text-gray-600">
                      Con una riduzione del 15% delle assenze, il risparmio netto è{' '}
                      <strong className="text-green-700">{fmt(roi.saving_15pct)}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tempo per dipendente */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Impegno di tempo per dipendente</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="text-2xl font-bold text-red-600">{calc.hours_treated}h</div>
                  <div className="text-xs text-gray-500 mt-1">Anno (trattato)</div>
                  <div className="text-xs text-gray-400">meno di 1h/mese</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                  <div className="text-2xl font-bold text-green-600">{calc.hours_untreated}h</div>
                  <div className="text-xs text-gray-500 mt-1">Anno (solo formazione)</div>
                  <div className="text-xs text-gray-400">solo incontri collettivi</div>
                </div>
              </div>
            </div>

            {/* Servizi inclusi */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Servizi inclusi Anno 1</div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Giornate sportello osteopatico', `${calc.days_osteo_y1} gg/anno`],
                    ['Sessioni formative', `${calc.training_sessions_y1} sessioni`],
                    ['Assessment (iniziale + finale)', '2'],
                    ['Review alla direzione', '2'],
                    ['Report annuale', '1'],
                    ['Coordinamento ES Work', 'Incluso'],
                    ['Documentazione OT23 INAIL', 'Inclusa'],
                  ].map(([label, val], i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-600">{label}</td>
                      <td className="py-2 text-right font-medium text-gray-700">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Genera offerta button */}
            <button
              onClick={goToOffer}
              className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base hover:bg-green-700 transition-colors"
            >
              Genera offerta grafica →
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { clientId, assessmentId, n, l1, l2 } = ctx.query;
  let client = null;
  if (clientId) {
    client = await getClientById(clientId);
  }
  return {
    props: {
      client: client || null,
      prefill: {
        assessmentId: assessmentId || null,
        n: n ? parseInt(n) : (client?.employees || 50),
        l1: l1 !== undefined ? parseInt(l1) : null,
        l2: l2 !== undefined ? parseInt(l2) : null,
      },
    },
  };
});
