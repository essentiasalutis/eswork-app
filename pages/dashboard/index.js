import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getSessionToken, verifyToken } from '../../lib/auth';
import { getClients, getAssessmentCounts, getAllAcuteEvents } from '../../lib/store';
import NavMenu from '../../components/NavMenu';
import { TYPE_COLORS, TYPE_LABELS } from '../../lib/scoring';

export default function Dashboard({ clients: initialClients, assessmentCounts, pendingAcuteCount }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  async function deleteClient(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Eliminare questo cliente e tutti i suoi dati?')) return;
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (res.ok) setClients(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900">ES </span>
            <span className="text-xl font-bold text-green-600">Work</span>
            <span className="text-sm text-gray-500 ml-2">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <NavMenu pendingAcuteCount={pendingAcuteCount} onLogout={logout} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800">Aziende clienti</h1>
          <button
            onClick={() => router.push('/dashboard/first-meeting')}
            className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl active:bg-green-700"
          >
            + Nuova azienda
          </button>
        </div>

        <div className="space-y-3">
          {clients.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🏢</div>
              <p>Nessuna azienda. Aggiungine una per iniziare.</p>
            </div>
          )}
          {clients.map(c => {
            const counts = assessmentCounts[c.id] || { total: 0, active: 0 };
            return (
              <Link key={c.id} href={`/dashboard/${c.id}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 active:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-base truncate">{c.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {c.employees} dipendenti · {c.sector === 1 ? 'Manifattura' : 'Ufficio/IT'}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500">{counts.total} assessment</span>
                        {counts.active > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {counts.active} attivo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={e => deleteClient(c.id, e)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                        title="Elimina"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps = require('../../lib/auth').requireAuthSsr(async () => {
  const [clients, assessmentCounts] = await Promise.all([
    getClients(),
    getAssessmentCounts(),
  ]);

  // Conta eventi acuti pending (graceful: tabella potrebbe non esistere ancora)
  let pendingAcuteCount = 0;
  try {
    const acuteEvents = await getAllAcuteEvents();
    pendingAcuteCount = acuteEvents.filter(e => e.status === 'pending').length;
  } catch (_) {
    pendingAcuteCount = 0;
  }

  return { props: { clients, assessmentCounts, pendingAcuteCount } };
});
