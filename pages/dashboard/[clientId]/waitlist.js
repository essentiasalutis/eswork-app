import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { requireAuthSsr } from '../../../lib/auth';
import { getClientById, getWaitlistByClient } from '../../../lib/store';

// Nota terminologia v4: i "turni di avvio" scaglionano l'inizio dei trattamenti L1
// (capienza sportello). La colonna DB resta `cohort` (solo storage).
const STATUS_LABELS = { pending: 'In attesa', assigned: 'Assegnato', cancelled: 'Annullato' };
const STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  assigned: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const TURNO_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500'];
const TURNO_MONTHS = ['Mese 1–2', 'Mese 2–3', 'Mese 3–4', 'Mese 4–5'];

export default function WaitlistPage({ client, waitlist: initialWaitlist }) {
  const [waitlist, setWaitlist] = useState(initialWaitlist);
  const [filterTurno, setFilterTurno] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [distributing, setDistributing] = useState(false);

  const filtered = waitlist.filter(e => {
    if (filterTurno && String(e.cohort) !== filterTurno) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  async function distributeTurni() {
    if (!confirm(`Distribuire ${waitlist.filter(e => e.status === 'pending' && !e.cohort).length} candidati in 4 turni di avvio automaticamente?`)) return;
    setDistributing(true);
    try {
      const pending = waitlist.filter(e => e.status === 'pending').sort((a, b) => (b.score || 0) - (a.score || 0));
      const turnoSize = Math.ceil(pending.length / 4);
      const updates = pending.map((e, i) => ({ id: e.id, cohort: Math.min(4, Math.floor(i / turnoSize) + 1) }));

      await Promise.all(updates.map(u =>
        fetch(`/api/waitlist/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cohort: u.cohort }) })
      ));

      setWaitlist(prev => prev.map(e => {
        const u = updates.find(x => x.id === e.id);
        return u ? { ...e, cohort: u.cohort } : e;
      }));
    } catch (e) {
      alert('Errore distribuzione: ' + e.message);
    }
    setDistributing(false);
  }

  const turnoStats = [1, 2, 3, 4].map(t => ({
    turno: t,
    count: waitlist.filter(e => e.cohort === t).length,
  }));

  return (
    <>
      <Head><title>Waitlist L1 — Turni di avvio — {client.name}</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link href={`/dashboard/${client.id}`} className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="font-semibold text-gray-900">Waitlist L1 — Turni di avvio — {client.name}</div>
              <div className="text-xs text-gray-500">{waitlist.filter(e => e.status === 'pending').length} candidati in attesa · ordinati per priority score</div>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={distributeTurni}
                disabled={distributing}
                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium disabled:opacity-50"
              >
                {distributing ? 'Distribuzione...' : '🎯 Distribuisci in turni'}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">

          {/* Timeline turni di avvio */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Timeline turni di avvio</div>
            <div className="flex gap-3">
              {turnoStats.map((t, i) => (
                <div key={t.turno} className="flex-1 text-center">
                  <div className={`h-3 rounded-full mb-2 ${TURNO_COLORS[i]}`} />
                  <div className="text-xs font-bold text-gray-600">Turno {t.turno}</div>
                  <div className="text-xs text-gray-400">{TURNO_MONTHS[i]}</div>
                  <div className="text-lg font-bold text-gray-800 mt-1">{t.count}</div>
                  <div className="text-xs text-gray-400">candidati</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-gray-100">
              {turnoStats.map((t, i) => {
                const total = waitlist.length || 1;
                const pct = Math.round(t.count / total * 100);
                return pct > 0 ? (
                  <div key={t.turno} className={`${TURNO_COLORS[i]} h-full`} style={{ width: `${pct}%` }} />
                ) : null;
              })}
            </div>
          </div>

          {/* Filtri */}
          <div className="flex gap-3">
            <select
              value={filterTurno}
              onChange={e => setFilterTurno(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm bg-white"
            >
              <option value="">Tutti i turni</option>
              {[1, 2, 3, 4].map(t => <option key={t} value={t}>Turno {t}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-sm bg-white"
            >
              <option value="">Tutti gli stati</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="ml-auto text-sm text-gray-400 self-center">{filtered.length} risultati</div>
          </div>

          {/* Tabella */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Dipendente', 'Sede', 'Score', 'Fonte', 'Turno', 'Stato', 'Data'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Nessun candidato in lista</td></tr>
                )}
                {filtered.map(entry => {
                  const pat = entry.patients || {};
                  return (
                    <tr key={entry.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/osteopath/patient/${pat.id}`} className="font-semibold text-gray-900 hover:text-blue-600">
                          {pat.first_name} {pat.last_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{pat.location || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-indigo-700">{entry.score || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs capitalize">{entry.source || '—'}</td>
                      <td className="px-4 py-3">
                        {entry.cohort
                          ? <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${TURNO_COLORS[(entry.cohort - 1) % 4]}`}>T{entry.cohort}</span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[entry.status] || STATUS_COLORS.pending}`}>
                          {STATUS_LABELS[entry.status] || entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString('it-IT') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async ({ params }) => {
  const { clientId } = params;
  const client = await getClientById(clientId).catch(() => null);
  if (!client) return { notFound: true };
  const waitlist = await getWaitlistByClient(clientId).catch(() => []);
  return { props: { client, waitlist } };
});
