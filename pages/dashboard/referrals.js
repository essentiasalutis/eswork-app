import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';
import { getAllReferralCodes } from '../../lib/store';
import NavMenu from '../../components/NavMenu';

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
  const [codes, setCodes] = useState(initialCodes);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  async function toggleActive(rc) {
    const res = await fetch(`/api/referrals/manage/${rc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rc.is_active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCodes(prev => prev.map(c => c.id === rc.id ? { ...c, is_active: updated.is_active } : c));
    }
  }

  async function deleteCode(rc) {
    const uses = rc.referral_uses?.length || 0;
    const msg = uses > 0
      ? `Eliminare il codice ${rc.code}? Ha già ${uses} utilizzo/i — verranno cancellati anche quelli.`
      : `Eliminare il codice ${rc.code}?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/referrals/manage/${rc.id}`, { method: 'DELETE' });
    if (res.ok) setCodes(prev => prev.filter(c => c.id !== rc.id));
  }

  // ── Statistiche globali ───────────────────────────────────────────────────
  const codesP = codes.filter(c => (c.type || 'P') === 'P');
  const codesF = codes.filter(c => c.type === 'F');
  const totalCodes = codes.length;
  const totalUsesP = codesP.reduce((s, c) => s + (c.referral_uses?.length || 0), 0);
  const totalUsesF = codesF.reduce((s, c) => s + (c.referral_uses?.length || 0), 0);
  const totalUses = totalUsesP + totalUsesF;
  // Conversione reale = redenti / richiesti (non più click/codici)
  const totalRedeemed = codes.reduce((s, c) => s + (c.referral_uses || []).filter(u => u.status === 'redeemed').length, 0);
  const globalConversion = pct(totalRedeemed, totalUses);
  // Revenue reale = somma degli importi dei buoni REDENTI (fallback al prezzo stimato)
  const totalRevenue = codes.reduce((s, c) => s + (c.referral_uses || [])
    .filter(u => u.status === 'redeemed')
    .reduce((a, u) => a + (u.amount != null ? Number(u.amount) : (c.session_price || 65)), 0), 0);

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
      if (!map[cid]) map[cid] = { clientName: c.clients?.name || '—', clientId: cid, codesP: [], codesF: [] };
      if ((c.type || 'P') === 'P') map[cid].codesP.push(c);
      else map[cid].codesF.push(c);
    });
    return Object.values(map).sort((a, b) => (b.codesP.length + b.codesF.length) - (a.codesP.length + a.codesF.length));
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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</Link>
            <span className="text-gray-300">|</span>
            <span className="text-base font-bold text-orange-700">🔗 Referral B2C</span>
          </div>
          <NavMenu onLogout={logout} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* KPI globali */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{totalUses}</div>
            <div className="text-xs text-gray-500 mt-1">Buoni richiesti (Dip {totalUsesP} / Fam {totalUsesF})</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totalRedeemed}</div>
            <div className="text-xs text-gray-500 mt-1">Buoni redenti (visite)</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{globalConversion}%</div>
            <div className="text-xs text-gray-500 mt-1">Conversione (redenti / richiesti)</div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">€{totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}</div>
            <div className="text-xs text-emerald-600 mt-1">Revenue reale (redenti)</div>
          </div>
        </div>

        {/* Alert d'incrocio: confermata dal paziente ma NON redenta dal pro */}
        {(() => {
          const mismatches = codes.flatMap(c => (c.referral_uses || [])
            .filter(u => u.confirm_response === 'done' && u.status !== 'redeemed')
            .map(u => ({ ...u, clientName: c.clients?.name || '', codeType: c.type || 'P' })));
          if (mismatches.length === 0) return null;
          return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-semibold text-red-800 text-sm mb-1">🚨 Visite confermate dal paziente ma NON redente dal professionista ({mismatches.length})</div>
              <div className="text-xs text-red-700 mb-2">Possibile elusione: il paziente dichiara di aver fatto la visita, ma il professionista non ha redento il buono. Da verificare.</div>
              <div className="space-y-1">
                {mismatches.map(m => (
                  <div key={m.id} className="text-sm text-red-800 flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.patient_name || '—'}</span>
                    <span className="text-xs text-red-500">{m.clientName}</span>
                    <span className="font-mono text-xs bg-white border border-red-200 px-1.5 py-0.5 rounded">{m.voucher_code || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

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
                  <th className="px-4 py-3 text-center">👤 Dip. rich.</th>
                  <th className="px-4 py-3 text-center">👤 Dip. redenti</th>
                  <th className="px-4 py-3 text-center">👨‍👩‍👧 Fam. rich.</th>
                  <th className="px-4 py-3 text-center">👨‍👩‍👧 Fam. redenti</th>
                  <th className="px-4 py-3 text-center">Conv.</th>
                  <th className="px-4 py-3 text-center text-emerald-700">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byClient.map(({ clientName, clientId, codesP: cp, codesF: cf }) => {
                  const reqP = cp.reduce((s, c) => s + (c.referral_uses?.length || 0), 0);
                  const reqF = cf.reduce((s, c) => s + (c.referral_uses?.length || 0), 0);
                  const redP = cp.reduce((s, c) => s + (c.referral_uses || []).filter(u => u.status === 'redeemed').length, 0);
                  const redF = cf.reduce((s, c) => s + (c.referral_uses || []).filter(u => u.status === 'redeemed').length, 0);
                  const conv = pct(redP + redF, reqP + reqF);
                  const revenue = [...cp, ...cf].reduce((s, c) => s + (c.referral_uses || [])
                    .filter(u => u.status === 'redeemed')
                    .reduce((a, u) => a + (u.amount != null ? Number(u.amount) : (c.session_price || 65)), 0), 0);
                  return (
                    <tr key={clientId} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/${clientId}`} className="font-medium text-blue-700 hover:underline">
                          {clientName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{reqP}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{redP}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{reqF}</td>
                      <td className="px-4 py-3 text-center font-semibold text-purple-600">{redF}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${conv >= 50 ? 'text-green-600' : conv >= 20 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {conv}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">
                        {revenue > 0 ? `€${revenue.toLocaleString('it-IT')}` : '—'}
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
                  <th className="px-4 py-3 text-center">Stato</th>
                  <th className="px-4 py-3 text-center">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyReport.map(c => {
                  const uses = c.referral_uses || [];
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50 ${!c.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-blue-700 text-xs">{c.code}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${(c.type||'P') === 'F' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                            {(c.type || 'P') === 'F' ? 'Fam.' : 'Dip.'}
                          </span>
                        </div>
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
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {c.is_active ? 'Attivo' : 'Stoppato'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => copyLink(c.code)}
                            className="text-xs text-gray-400 hover:text-blue-700 transition-colors"
                            title="Copia link"
                          >
                            {copiedCode === c.code ? '✅' : '🔗'}
                          </button>
                          <button
                            onClick={() => toggleActive(c)}
                            className={`text-xs font-medium transition-colors ${c.is_active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                            title={c.is_active ? 'Stoppa link' : 'Riattiva link'}
                          >
                            {c.is_active ? '⏸ Stoppa' : '▶ Riattiva'}
                          </button>
                          <button
                            onClick={() => deleteCode(c)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            title="Elimina"
                          >
                            🗑
                          </button>
                        </div>
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
