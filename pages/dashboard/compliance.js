import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';
import NavMenu from '../../components/NavMenu';

export default function CompliancePage({ data: initialData, carta = null }) {
  const router = useRouter();
  const [data] = useState(initialData || []);
  const [expanded, setExpanded] = useState({});

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const totalPatients = data.reduce((s, c) => s + c.total, 0);
  const totalComplete = data.reduce((s, c) => s + c.complete, 0);
  const globalPct = totalPatients ? Math.round((totalComplete / totalPatients) * 100) : 0;

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</Link>
            <span className="text-gray-300">|</span>
            <span className="text-base font-bold text-teal-700">📄 Compliance documenti</span>
          </div>
          <NavMenu onLogout={logout} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* KPI globali */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{totalPatients}</div>
            <div className="text-sm text-gray-500 mt-1">Pazienti con sedute previste</div>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{totalComplete}</div>
            <div className="text-sm text-gray-500 mt-1">Documenti completi</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{globalPct}%</div>
            <div className="text-sm text-gray-500 mt-1">Compliance globale</div>
          </div>
        </div>

        {/* Tabella per azienda */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Stato per azienda</h2>
            <p className="text-xs text-gray-500 mt-0.5">Livello 1 e Livello 2 con prevenzione. Un consenso conta solo se legato a una versione dell&apos;archivio — click su una riga per i dettagli</p>
          </div>

          {data.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nessun paziente con sedute previste.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.map(c => {
                const pct = c.total ? Math.round((c.complete / c.total) * 100) : 0;
                const isOpen = expanded[c.clientId];
                return (
                  <div key={c.clientId}>
                    {/* Riga azienda */}
                    <div
                      className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                      onClick={() => toggle(c.clientId)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm">{isOpen ? '▼' : '▶'}</span>
                        <Link
                          href={`/dashboard/${c.clientId}`}
                          className="font-medium text-blue-700 hover:underline text-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          {c.clientName}
                        </Link>
                        <span className="text-xs text-gray-400">{c.total} pazienti</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Barra progresso */}
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ef4444' }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 w-8 text-right">{pct}%</span>
                        </div>
                        <span className="text-xs text-green-600 font-semibold w-16 text-right">{c.complete}/{c.total} ok</span>
                      </div>
                    </div>

                    {/* Dettaglio pazienti */}
                    {isOpen && (
                      <div className="bg-gray-50 border-t border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 uppercase tracking-wide">
                              <th className="px-8 py-2 text-left">Paziente</th>
                              <th className="px-3 py-2 text-center">Consenso trattamento</th>
                              <th className="px-3 py-2 text-center">Privacy GDPR</th>
                              <th className="px-3 py-2 text-center">Anamnesi ES Work</th>
                              <th className="px-3 py-2 text-center">Export PDF</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {c.patients.map(p => (
                              <tr key={p.id} className="hover:bg-white">
                                <td className="px-8 py-2.5">
                                  <span className={`font-medium ${p.complete ? 'text-gray-800' : 'text-gray-500'}`}>
                                    {p.name}
                                  </span>
                                  {p.level === 'level2' && <span className="ml-2 text-gray-400">L2 prevenzione</span>}
                                  {p.suCarta && <span className="ml-2 text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">su carta</span>}
                                </td>
                                <td className="px-3 py-2.5 text-center">{p.consent ? '✅' : '⚠️'}</td>
                                <td className="px-3 py-2.5 text-center">{p.privacy ? '✅' : '⚠️'}</td>
                                <td className="px-3 py-2.5 text-center">{p.anamnesi ? '✅' : '⚠️'}</td>
                                <td className="px-3 py-2.5 text-center">
                                  {p.complete ? (
                                    <a
                                      href={`/dashboard/patients/${p.id}/export`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline font-medium"
                                    >
                                      📄 PDF
                                    </a>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Firme su carta: l'eccezione resta un'eccezione? */}
        {carta && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800">Firme su carta</h2>
            <p className="text-xs text-gray-500 mt-0.5">La firma in piattaforma è la regola. Se la carta cresce, c&apos;è un problema operativo da risolvere.</p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center"><div className="text-2xl font-bold text-gray-900">{carta.consensiInPiattaforma}</div><div className="text-xs text-gray-500">consensi in piattaforma</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-amber-600">{carta.consensiSuCarta}</div><div className="text-xs text-gray-500">consensi su carta (validi oggi)</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-gray-900">{(carta.consensiInPiattaforma + carta.consensiSuCarta) ? Math.round(carta.consensiSuCarta / (carta.consensiInPiattaforma + carta.consensiSuCarta) * 100) : 0}%</div><div className="text-xs text-gray-500">quota su carta</div></div>
            </div>
            {carta.caricamenti > 0 && (
              <div className="grid md:grid-cols-2 gap-6 mt-5 text-sm">
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Perché ({carta.caricamenti} caricamenti)</div>
                  {Object.entries(carta.perMotivo).map(([k, n]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-gray-100"><span>{carta.motivi[k]}</span><span className="font-semibold tabular-nums">{n}</span></div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Per osteopata</div>
                  {carta.perOsteopata.map(o => (
                    <div key={o.id} className="flex justify-between py-1 border-b border-gray-100">
                      <span>{o.nome}</span>
                      <span className="text-gray-500">{Object.entries(o.motivi).map(([k, n]) => `${carta.motivi[k]} ${n}`).join(' · ')} <strong className="text-gray-900 tabular-nums ml-2">{o.caricamenti}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Note normative */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
          <strong>📋 Nota sulla conservazione:</strong> I documenti firmati vengono conservati per almeno 10 anni dall'ultima seduta del paziente, in conformità agli obblighi normativi sulle cartelle cliniche (D.Lgs 196/2003, GDPR, normativa sanitaria). Alla scadenza del termine i dati vengono cancellati su procedura del titolare del trattamento (cancellazione assistita e validata). Lo stato è consultabile nella sezione &quot;Conservazione dati&quot;.
        </div>

      </main>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const { requireAuthSsr } = await import('../../lib/auth');
  const authResult = await requireAuthSsr(ctx);
  if (authResult.redirect) return authResult;

  try {
    const { datiConformita } = await import('../../lib/conformita');
    const j = await datiConformita();
    return { props: { data: j.aziende, carta: j.carta } };
  } catch (e) {
    console.error('[compliance] dati:', e.message);
    return { props: { data: [], carta: null } };
  }
}
