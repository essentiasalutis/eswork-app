import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';
import { getAllReferralCodes } from '../../lib/store';

// ─── Helper ────────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pct(used, total) {
  if (!total) return 0;
  return Math.round((used / total) * 100);
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function ReferralsPage({ codes: initialCodes }) {
  const router = useRouter();
  const [codes] = useState(initialCodes);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  // ── Statistiche globali ───────────────────────────────────────────────────
  const totalCodes = codes.length;
  const totalUses = codes.reduce((s, c) => s + (c.referral_uses?.length || 0), 0);
  const globalConversion = pct(totalUses, totalCodes);

  // ── Report mensile ────────────────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const months = new Set();
    codes.forEach(c => {
      const d = new Date(c.created_at);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [codes]);

  // ── Per-client stats ──────────────────────────────────────────────────────
  const byClient = useMemo(() => {
    const map = {};
    codes.forEach(c => {
      const cid = c.client_id;
      if (!map[cid]) map[cid] = { clientName: c.clients?.name || '—', clientId: cid, codes: [] };
      map[cid].codes.push(c);
    });
    return Object.values(map).sort((a, b) => b.codes.length - a.codes.length);
  }, [codes]);

  // ── Report mensile ────────────────────────────────────────────────────────
  const monthlyReport = useMemo(() => {
    const target = monthFilter === 'all' ? null : monthFilter;
    return codes.filter(c => {
      if (!target) return true;
      const d = new Date(c.created_at);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return m === target;
    }).filter(c => !search || c.clients?.name?.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()));
  }, [codes, monthFilter, search]);

  const monthlyUses = monthlyReport.reduce((s, c) => s + (c.referral_uses?.length || 0), 0);

  // ── Copia link ────────────────────────────────────────────────────────────
  const [copiedCode, setCopiedCode] = useState(null);
  function copyLink(code) {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    navigator.clipboard.writeText(`${base}/care/${code}`).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</Link>
            <span className="text-gray-300">|</span>
            <span className="text-base font-bold text-orange-700">🔗 Referral B2C</span>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800 py-2 px-3">
            Esci
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* KPI globali */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{totalCodes}</div>
            <div className="text-sm text-gray-500 mt-1">Codici distribuiti</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{totalUses}</div>
            <div className="text-sm text-gray-500 mt-1">Codici usati</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{globalConversion}%</div>
            <div className="text-sm text-gray-500 mt-1">Tasso di conversione</div>
          </div>
        </div>

        {/* Stats per azienda */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Per azienda</h2>
          </div>
          {byClient.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">Nessun codice ancora generato.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Azienda</th>
                  <th className="px-4 py-3 text-center">Distribuiti</th>
                  <th className="px-4 py-3 text-center">Usati</th>
                  <th className="px-4 py-3 text-center">Conversione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byClient.map(({ clientName, clientId, codes: cc }) => {
                  const used = cc.reduce((s, c) => s + (c.referral_uses?.length || 0), 0);
                  const conv = pct(used, cc.length);
                  return (
                    <tr key={clientId} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/${clientId}`} className="font-medium text-blue-700 hover:underline">
                          {clientName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{cc.length}</td>
                      <td className="px-4 py-3 text-center text-green-600 font-medium">{used}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${conv >= 50 ? 'text-green-600' : conv >= 20 ? 'text-yellow-600' : 'text-gray-500'}`}>
                          {conv}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Report mensile */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-gray-800">Report codici</h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca azienda o codice…"
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300"
                style={{ minWidth: 200 }}
              />
              <select
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="all">Tutti i mesi</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary filtro */}
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 text-sm text-orange-700">
            <strong>{monthlyReport.length}</strong> codici nel periodo selezionato ·{' '}
            <strong>{monthlyUses}</strong> utilizzi ·{' '}
            <strong>{pct(monthlyUses, monthlyReport.length)}%</strong> conversione
          </div>

          {monthlyReport.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">Nessun codice trovato.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Codice</th>
                  <th className="px-4 py-3 text-left">Azienda</th>
                  <th className="px-4 py-3 text-center">Generato</th>
                  <th className="px-4 py-3 text-center">Utilizzi</th>
                  <th className="px-4 py-3 text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyReport.map(c => {
                  const uses = c.referral_uses || [];
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="font-mono font-semibold text-blue-700 text-xs">{c.code}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.clients?.name || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        {uses.length > 0 ? (
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {uses.length} {uses.length === 1 ? 'uso' : 'usi'}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => copyLink(c.code)}
                          className="text-xs text-gray-500 hover:text-blue-700 transition-colors"
                          title="Copia link /care/[code]"
                        >
                          {copiedCode === c.code ? '✅ Copiato' : '🔗 Link'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Dettaglio utilizzi */}
        {monthlyReport.some(c => (c.referral_uses?.length || 0) > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Dettaglio utilizzi</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Codice</th>
                  <th className="px-4 py-3 text-left">Azienda</th>
                  <th className="px-4 py-3 text-left">Paziente</th>
                  <th className="px-4 py-3 text-center">Data utilizzo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyReport.flatMap(c =>
                  (c.referral_uses || []).map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-xs text-blue-700">{c.code}</td>
                      <td className="px-4 py-3 text-gray-700">{c.clients?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{u.patient_name || <span className="text-gray-400 italic">anonimo</span>}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{fmtDate(u.used_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  const codes = await getAllReferralCodes();
  return { props: { codes } };
});
