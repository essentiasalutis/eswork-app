import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getAllRestratAlerts } from '../../lib/store';

const SOURCE_BADGE = {
  self_trigger:  { label: '🙋 Self-trigger',  cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  checkpoint:    { label: '📅 Checkpoint',    cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  osteopath:     { label: '🦴 Osteopata',     cls: 'bg-green-100 text-green-800 border-green-200' },
};

const STATUS_BADGE = {
  pending:        { label: '⏳ Da valutare',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  confirmed_l1:   { label: '✅ Confermato L1',  cls: 'bg-green-100 text-green-800 border-green-200' },
  not_confirmed:  { label: '❌ Non confermato', cls: 'bg-red-100 text-red-800 border-red-200' },
};

export default function RestratificationsPage({ alerts: initialAlerts }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [updating, setUpdating] = useState(null);

  async function changeStatus(id, status) {
    setUpdating(id);
    try {
      const res = await fetch('/api/admin/restratifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: updated.status } : a));
      }
    } catch (e) {
      console.error(e);
    }
    setUpdating(null);
  }

  return (
    <>
      <Head><title>Ri-stratificazioni — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Ri-stratificazioni</div>
              <div className="text-xs text-gray-500">Segnali di possibile cambio livello</div>
            </div>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full">
              {alerts.filter(a => a.status === 'pending').length} da valutare
            </span>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-6">
          {alerts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-sm">Nessun segnale di ri-stratificazione al momento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => {
                const source = SOURCE_BADGE[alert.source] || SOURCE_BADGE.self_trigger;
                const statusInfo = STATUS_BADGE[alert.status] || STATUS_BADGE.pending;
                const patientName = alert.patients
                  ? `${alert.patients.first_name} ${alert.patients.last_name}`
                  : 'Paziente';
                const clientName = alert.clients?.name || '—';
                const date = new Date(alert.created_at).toLocaleDateString('it-IT', {
                  day: '2-digit', month: 'short', year: 'numeric',
                });

                return (
                  <div key={alert.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{patientName}</div>
                        <div className="text-sm text-gray-500">{clientName} · {date}</div>
                        {alert.notes && (
                          <div className="mt-1 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1">{alert.notes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${source.cls}`}>
                          {source.label}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Pulsanti cambio status */}
                    {alert.status !== 'confirmed_l1' || alert.status !== 'not_confirmed' ? (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {alert.status !== 'confirmed_l1' && (
                          <button
                            onClick={() => changeStatus(alert.id, 'confirmed_l1')}
                            disabled={updating === alert.id}
                            className="text-xs px-3 py-1.5 rounded-xl bg-green-50 border border-green-300 text-green-700 font-semibold disabled:opacity-50"
                          >
                            ✅ Conferma L1
                          </button>
                        )}
                        {alert.status !== 'not_confirmed' && (
                          <button
                            onClick={() => changeStatus(alert.id, 'not_confirmed')}
                            disabled={updating === alert.id}
                            className="text-xs px-3 py-1.5 rounded-xl bg-red-50 border border-red-300 text-red-700 font-semibold disabled:opacity-50"
                          >
                            ❌ Non confermato
                          </button>
                        )}
                        {alert.status !== 'pending' && (
                          <button
                            onClick={() => changeStatus(alert.id, 'pending')}
                            disabled={updating === alert.id}
                            className="text-xs px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-600 font-semibold disabled:opacity-50"
                          >
                            ⏳ Riporta a da valutare
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  const alerts = await getAllRestratAlerts();
  return { props: { alerts } };
});
