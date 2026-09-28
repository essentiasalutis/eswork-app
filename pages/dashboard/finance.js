import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getClients, getFirstMeeting } from '../../lib/store';
import { fmt } from '../../lib/calculator';
import { tierFromEmployees } from '../../lib/pricing/tier';
import NavMenu from '../../components/NavMenu';
import { trovaStage, normalizza, isFirmato, isAperto } from '../../lib/pipeline';

const TIER_COLORS = { core: '#6b7280', plus: '#2563eb', enterprise: '#7c3aed' };
const TIER_LABELS = { core: 'Core', plus: 'Plus', enterprise: 'Enterprise' };

function getTier(employees) {
  return tierFromEmployees(employees); // fonte unica: lib/pricing/tier.js
}

// Numeri economici di ogni azienda dalla STESSA fonte dell'Offerta (Enrico, 28/9: «allineala»).
// Dopo il check-up: il prezzo dell'Offerta (Livello 1 e 2 osservati, tetto e prezzo applicato
// compresi) e il suo costo. Prima: la Stima registrata, media della forbice, senza costo.
// Senza l'uno né l'altra: nessun valore, e la riga lo dice. Fino a oggi qui si stimava il
// Livello 1 per settore (17% / 12%) e il Livello 2 come Livello 1 × 2,2, contando i soli
// rispondenti: numeri di riserva che scattavano senza dirlo.
const FONTE = {
  checkup: (e) => `dal check-up (${e.risposte} risposte)`,
  stima: (e) => `Stima registrata: media di ${fmt(e.min)} – ${fmt(e.max)}`,
  errore: (e) => e.nota || 'prezzo non calcolabile',
  nessuna: () => 'nessun check-up né Stima registrata',
};

export default function FinancePage({ clients, economia = {} }) {
  // Le aziende DEMO (clients.is_demo, v49) restano VISIBILI in tabella con badge,
  // ma non entrano in NESSUN aggregato economico: ARR, pipeline, forecast, margini
  // e revenue per tier devono riflettere solo clienti reali. Senza questo filtro il
  // primo cliente vero sarebbe sommato ai 500 pazienti della demo.
  const realClients = clients.filter(c => !c.is_demo);
  const demoCount = clients.length - realClients.length;

  // Stati dalla fonte unica lib/pipeline.js. Accettato = contratto firmato: entra
  // nell'ARR (ricavo annuo contrattualizzato). In trattativa = aperti tranne "Non ora".
  const activeClients = realClients.filter(c => isFirmato(c.pipeline_stage));
  const prospectClients = realClients.filter(c => isAperto(c.pipeline_stage) && normalizza(c.pipeline_stage) !== 'not_now');
  const nonOraCount = realClients.filter(c => normalizza(c.pipeline_stage) === 'not_now').length;

  // KPI
  let totalARR = 0;
  let totalCost = 0;
  let ricavoConCosto = 0;   // il margine si calcola solo dove il costo è noto
  const clientsWithFinance = clients.map(c => {
    const e = economia[c.id] || { fonte: 'nessuna' };
    const isActive = isFirmato(c.pipeline_stage);
    const revenue = e.revenue || 0;
    const cost = e.cost || 0;
    const margin = revenue > 0 && cost > 0 ? Math.round(((revenue - cost) / revenue) * 100) : null;
    if (isActive && !c.is_demo) {
      totalARR += revenue;
      if (cost > 0) { totalCost += cost; ricavoConCosto += revenue; }
    }
    return { ...c, revenue, cost, margin, l1: e.l1 ?? null, l2: e.l2 ?? null, fonte: (FONTE[e.fonte] || FONTE.nessuna)(e), errore: e.fonte === 'errore' };
  });

  const totalMargin = ricavoConCosto > 0 ? Math.round((1 - totalCost / ricavoConCosto) * 100) : 0;

  const pipelineValue = prospectClients.reduce((sum, c) => {
    const cf = clientsWithFinance.find(x => x.id === c.id);
    return sum + (cf?.revenue || 0);
  }, 0);

  // Revenue per tier
  const byTier = { core: 0, plus: 0, enterprise: 0 };
  clientsWithFinance.filter(c => isFirmato(c.pipeline_stage) && !c.is_demo).forEach(c => {
    const t = getTier(c.employees);
    byTier[t] += c.revenue;
  });

  // Forecast 6 mesi: ARR + metà del valore delle offerte aperte (le più vicine alla firma).
  const offerteAperte = realClients.filter(c => normalizza(c.pipeline_stage) === 'offer_open');
  const forecast6m = offerteAperte.reduce((sum, c) => {
    const cf = clientsWithFinance.find(x => x.id === c.id);
    return sum + (cf?.revenue || 0) * 0.5;
  }, 0);

  return (
    <>
      <Head><title>Finance — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
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

        <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          {/* KPI principali */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'ARR Attuale', value: fmt(totalARR), sub: `${activeClients.length} ${activeClients.length === 1 ? 'cliente accettato' : 'clienti accettati'}`, color: '#16a34a' },
              { label: 'Margine Lordo', value: `${totalMargin}%`, sub: `Costi: ${fmt(totalCost)}`, color: totalMargin > 40 ? '#16a34a' : '#ca8a04' },
              { label: 'Pipeline Value', value: fmt(pipelineValue), sub: `${prospectClients.length} in trattativa${nonOraCount ? ` · ${nonOraCount} in Non ora` : ''}`, color: '#2563eb' },
              { label: 'Forecast 6m', value: fmt(totalARR + forecast6m), sub: `+${fmt(forecast6m)} da ${offerteAperte.length} ${offerteAperte.length === 1 ? 'proposta aperta' : 'proposte aperte'}`, color: '#7c3aed' },
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
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue per tier (clienti accettati)</div>
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
                          {c.is_demo && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 align-middle">DEMO</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.employees || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: TIER_COLORS[tier] }}>
                            {TIER_LABELS[tier]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => { const st = trovaStage(c.pipeline_stage); return (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                              {st.label}
                            </span>
                          ); })()}
                        </td>
                        <td className="px-4 py-3 text-gray-600" title="Persone attese sull'intera popolazione, dalle risposte del check-up">{c.l1 != null ? `${c.l1} / ${c.l2}` : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-green-700">{c.revenue > 0 ? fmt(c.revenue) : '—'}</div>
                          <div className={`text-[11px] ${c.errore ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{c.fonte}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{c.cost > 0 ? fmt(c.cost) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${c.margin > 40 ? 'text-green-600' : c.margin > 30 ? 'text-amber-600' : 'text-red-600'}`}>
                            {c.margin != null ? `${c.margin}%` : '—'}
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
            <strong>Note:</strong> {demoCount > 0 && <>Le {demoCount} aziende marcate <strong>DEMO</strong> sono elencate ma <strong>escluse</strong> da ARR, pipeline, forecast, margini e revenue per tier. </>}Revenue e L1/L2 vengono dalla stessa fonte dell&apos;Offerta: dopo il check-up il prezzo proposto (Livello 1 e 2 osservati, riportati su tutta la popolazione); prima, la media della forbice della Stima registrata, senza costo né margine; senza l&apos;uno né l&apos;altra nessun valore. Il margine totale conta solo le aziende con il costo noto. Gli stati sono quelli della Pipeline: gli <strong>accettati</strong> (contratto firmato) formano l&apos;ARR, il forecast aggiunge metà del valore delle <strong>offerte aperte</strong>, i &laquo;Non ora&raquo; restano fuori dal valore della pipeline. Margini calcolati senza costi fissi aziendali.
          </div>
        </main>
      </div>
    </>
  );
}

// Una riga di Finanza = quello che l'Offerta proporrebbe oggi (lib/offerta-server.js).
async function economiaCliente(c) {
  const [{ statoCheckupCliente }, { datiOffertaDaCheckup }] = await Promise.all([
    import('../../lib/checkup-server'), import('../../lib/offerta-server'),
  ]);
  const stato = await statoCheckupCliente(c).catch(() => null);
  const a = stato && stato.assessment;
  if (a) {
    try {
      const d = await datiOffertaDaCheckup({ assessmentId: a.id, n: c.employees });
      if (d && d.errore) return { fonte: 'errore', nota: d.errore };
      if (d && d.calc && d.responders > 0) {
        const cost = d.costoAnno1 != null ? d.costoAnno1 : (d.calc.y1 ? d.calc.y1.total_cost : null);
        return { fonte: 'checkup', risposte: d.responders, l1: d.calc.l1, l2: d.calc.l2, revenue: d.calc.price_y1, cost: cost != null ? Math.round(cost) : null };
      }
    } catch (e) {
      return { fonte: 'errore', nota: (e && e.message) || 'prezzo non calcolabile' };
    }
  }
  const fm = await getFirstMeeting(c.id).catch(() => null);
  const f = fm && fm.stima_snapshot && fm.stima_snapshot.forchetta;
  if (f && f.min && f.max && f.min.price_y1 != null && f.max.price_y1 != null) {
    const media = f.avg && f.avg.price_y1 != null ? f.avg.price_y1 : Math.round((f.min.price_y1 + f.max.price_y1) / 2);
    return { fonte: 'stima', revenue: media, min: f.min.price_y1, max: f.max.price_y1 };
  }
  return { fonte: 'nessuna' };
}

export const getServerSideProps = requireAuthSsr(async () => {
  try {
    const clients = await getClients();

    const economia = {};
    await Promise.all(clients.map(async c => { economia[c.id] = await economiaCliente(c); }));
    return { props: { clients, economia: JSON.parse(JSON.stringify(economia)) } };
  } catch {
    return { props: { clients: [], economia: {} } };
  }
});
