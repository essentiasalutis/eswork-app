import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getClients, getPatientsByClient } from '../../lib/store';
import { calculatePricing, fmt } from '../../lib/calculator';
import NavMenu from '../../components/NavMenu';

const STAGE_COLORS = {
  prospect: 'bg-gray-100 text-gray-600',
  contacted: 'bg-blue-50 text-blue-700',
  proposal: 'bg-amber-50 text-amber-700',
  negotiation: 'bg-purple-50 text-purple-700',
  signed: 'bg-green-100 text-green-800',
  active: 'bg-green-600 text-white',
  closed: 'bg-gray-100 text-gray-400',
};

const STAGE_LABELS = {
  prospect: 'Prospect', contacted: 'Contattato', proposal: 'Offerta inviata',
  negotiation: 'In trattativa', signed: 'Firmato', active: 'Attivo', closed: 'Chiuso',
};

const TIER_COLORS = { core: '#6b7280', plus: '#2563eb', enterprise: '#7c3aed' };
const TIER_LABELS = { core: 'Core', plus: 'Plus', enterprise: 'Enterprise' };

function getTier(employees) {
  const n = parseInt(employees) || 0;
  if (n <= 150) return 'core';
  if (n <= 500) return 'plus';
  return 'enterprise';
}

// Stima L1 da dipendenti (avg sector)
function estimateL1(employees, sector) {
  const n = parseInt(employees) || 0;
  return Math.round(n * (sector === 1 ? 0.17 : 0.12));
}

export default function FinancePage({ clients, patientCounts }) {
  const activeClients = clients.filter(c => c.pipeline_stage === 'active' || c.pipeline_stage === 'signed');
  const prospectClients = clients.filter(c => !['active', 'closed'].includes(c.pipeline_stage));

  // KPI
  let totalARR = 0;
  let totalCost = 0;
  const clientsWithFinance = clients.map(c => {
    const l1 = patientCounts[c.id]?.l1 || estimateL1(c.employees, c.sector);
    const l2 = patientCounts[c.id]?.l2 || Math.round(l1 * 2.2);
    const calc = calculatePricing(parseInt(c.employees) || 0, l1, l2);
    const isActive = c.pipeline_stage === 'active';
    const revenue = calc?.price_y1 || 0;
    const cost = calc?.total_cost_y1 || 0;
    const margin = cost > 0 ? Math.round((1 - cost / revenue) * 100) : 0;
    if (isActive) { totalARR += revenue; totalCost += cost; }
    return { ...c, calc, revenue, cost, margin, l1, l2 };
  });

  const totalMargin = totalARR > 0 ? Math.round((1 - totalCost / totalARR) * 100) : 0;

  const pipelineValue = prospectClients.reduce((sum, c) => {
    const cf = clientsWithFinance.find(x => x.id === c.id);
    return sum + (cf?.revenue || 0);
  }, 0);

  // Revenue per tier
  const byTier = { core: 0, plus: 0, enterprise: 0 };
  clientsWithFinance.filter(c => c.pipeline_stage === 'active').forEach(c => {
    const t = getTier(c.employees);
    byTier[t] += c.revenue;
  });

  // Forecast 6 mesi (signed → attivi entro 6 mesi)
  const signedClients = clients.filter(c => c.pipeline_stage === 'signed');
  const forecast6m = signedClients.reduce((sum, c) => {
    const cf = clientsWithFinance.find(x => x.id === c.id);
    return sum + (cf?.revenue || 0) * 0.5; // stima 50% del valore Y1 nei primi 6 mesi
  }, 0);

  return (
    <>
      <Head><title>Finance — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="font-semibold text-gray-900">Dashboard Finance</div>
              <div className="text-xs text-gray-500">Solo uso interno Essentia Salutis</div>
            </div>
            <span className="ml-auto text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-full font-semibold">🔒 Riservato</span>
            <NavMenu />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {/* KPI principali */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'ARR Attuale', value: fmt(totalARR), sub: `${activeClients.length} clienti attivi`, color: '#16a34a' },
              { label: 'Margine Lordo', value: `${totalMargin}%`, sub: `Costi: ${fmt(totalCost)}`, color: totalMargin > 40 ? '#16a34a' : '#ca8a04' },
              { label: 'Pipeline Value', value: fmt(pipelineValue), sub: `${prospectClients.length} prospect`, color: '#2563eb' },
              { label: 'Forecast 6m', value: fmt(totalARR + forecast6m), sub: `+${fmt(forecast6m)} da signed`, color: '#7c3aed' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="text-xs text-gray-400 mb-1">{k.label}</div>
                <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="text-xs text-gray-500 mt-1">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Revenue per tier */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue per tier (clienti attivi)</div>
            <div className="grid grid-cols-3 gap-4">
              {['core', 'plus', 'enterprise'].map(t => (
                <div key={t} className="text-center">
                  <div className="text-2xl font-bold" style={{ color: TIER_COLORS[t] }}>{fmt(byTier[t])}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: TIER_COLORS[t] }}>{TIER_LABELS[t]}</div>
                  <div className="text-xs text-gray-400">{totalARR > 0 ? Math.round(byTier[t] / totalARR * 100) : 0}% del totale</div>
                </div>
              ))}
            </div>
            {totalARR > 0 && (
              <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                {['core', 'plus', 'enterprise'].map(t => (
                  <div key={t} style={{ width: `${Math.round(byTier[t] / totalARR * 100)}%`, background: TIER_COLORS[t] }} className="h-full transition-all" />
                ))}
              </div>
            )}
          </div>

          {/* Tabella clienti */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tutti i clienti</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Cliente', 'Dip.', 'Tier', 'Stage', 'L1/L2', 'Revenue Y1', 'Costo', 'Margine'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientsWithFinance.map(c => {
                    const tier = getTier(c.employees);
                    return (
                      <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{c.name}</Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.employees || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: TIER_COLORS[tier] }}>
                            {TIER_LABELS[tier]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[c.pipeline_stage] || STAGE_COLORS.prospect}`}>
                            {STAGE_LABELS[c.pipeline_stage] || c.pipeline_stage || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.l1} / {c.l2}</td>
                        <td className="px-4 py-3 font-semibold text-green-700">{c.revenue > 0 ? fmt(c.revenue) : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{c.cost > 0 ? fmt(c.cost) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${c.margin > 40 ? 'text-green-600' : c.margin > 30 ? 'text-amber-600' : 'text-red-600'}`}>
                            {c.revenue > 0 ? `${c.margin}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700">
            <strong>Note:</strong> I valori revenue e L1/L2 sono stime basate sul calcolatore quando i dati reali non sono disponibili. I clienti "signed" sono inclusi nel forecast ma non nell&apos;ARR corrente. Margini calcolati senza costi fissi aziendali.
          </div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  try {
    const clients = await getClients();

    // Per ogni cliente, conta L1/L2 reali
    const patientCounts = {};
    await Promise.all(
      clients.map(async c => {
        const patients = await getPatientsByClient(c.id).catch(() => []);
        patientCounts[c.id] = {
          l1: patients.filter(p => p.level === 'level1').length,
          l2: patients.filter(p => p.level === 'level2').length,
          total: patients.length,
        };
      })
    );

    return { props: { clients, patientCounts } };
  } catch {
    return { props: { clients: [], patientCounts: {} } };
  }
});
