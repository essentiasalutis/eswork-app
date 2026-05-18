import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getAllRestratAlerts, getAllPatients } from '../../lib/store';
import { CONFIG } from '../../lib/config';

// Sessioni per un nuovo L1 (protocollo Anno 1)
const SESSIONS_PER_NEW_L1 = (CONFIG.sessions_intensive + CONFIG.sessions_maintenance) * CONFIG.completion_rate;

const SOURCE_BADGE = {
  self_trigger: { label: '🙋 Self-trigger', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  checkpoint:   { label: '📅 Checkpoint',   cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  osteopath:    { label: '🦴 Osteopata',    cls: 'bg-green-100 text-green-800 border-green-200' },
};

const STATUS_BADGE = {
  pending:       { label: '⏳ Da valutare',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  confirmed_l1:  { label: '✅ Confermato L1',  cls: 'bg-green-100 text-green-800 border-green-200' },
  not_confirmed: { label: '❌ Non confermato', cls: 'bg-red-100 text-red-800 border-red-200' },
};

function BufferBar({ used, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = pct >= 90 ? '#dc2626' : pct >= 60 ? '#ca8a04' : '#16a34a';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{used} confermati su {max} disponibili</span>
        <span style={{ color }} className="font-semibold">{100 - pct}% residuo</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function RestratificationsPage({ alerts: initialAlerts, bufferByClient, dbError }) {
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

  // Conta confermati per client in tempo reale
  function confirmedForClient(clientId) {
    return alerts.filter(a => a.client_id === clientId && a.status === 'confirmed_l1').length;
  }

  const pendingCount = alerts.filter(a => a.status === 'pending').length;

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
              <div className="font-semibold text-gray-900">Ri-stratificazioni L2→L1</div>
              <div className="text-xs text-gray-500">Candidati al passaggio a trattamento attivo</div>
            </div>
            {pendingCount > 0 && (
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-full">
                {pendingCount} da valutare
              </span>
            )}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {dbError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
              <strong>⚠️ Migrazione SQL mancante.</strong> Esegui <code className="bg-amber-100 px-1 rounded">supabase-schema-v11-restratification.sql</code> nel SQL Editor di Supabase per attivare questa sezione.
            </div>
          )}

          {/* ── Buffer per azienda ─────────────────────────────────────── */}
          {bufferByClient && bufferByClient.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Capacità buffer 15% per azienda
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {bufferByClient.map(c => {
                  const confirmed = confirmedForClient(c.client_id);
                  const remaining = Math.max(0, c.max_new_l1 - confirmed);
                  const isOver = confirmed > c.max_new_l1;
                  return (
                    <div key={c.client_id}
                      className={`bg-white rounded-2xl border p-4 ${isOver ? 'border-red-300' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{c.client_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {c.l1_count} L1 attivi · {c.l2_count} L2 monitorati
                          </div>
                        </div>
                        <div className={`text-right ${isOver ? 'text-red-600' : remaining === 0 ? 'text-amber-600' : 'text-green-700'}`}>
                          <div className="text-2xl font-bold">{remaining}</div>
                          <div className="text-xs font-medium">slot liberi</div>
                        </div>
                      </div>
                      <BufferBar used={confirmed} max={c.max_new_l1} />
                      <div className="text-xs text-gray-400 mt-2">
                        Buffer: {c.buffer_sessions} sessioni tot. · {c.max_new_l1} nuovi L1 max (a {Math.round(SESSIONS_PER_NEW_L1)} sess/persona)
                        {isOver && <span className="ml-1 text-red-600 font-semibold">⚠️ Limite superato</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Lista segnalazioni ─────────────────────────────────────── */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Segnalazioni ricevute
            </div>
            {alerts.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-sm">Nessun segnale di ri-stratificazione al momento</p>
                <p className="text-xs mt-1 text-gray-300">I segnali arrivano da: self-trigger dipendente, checkpoint T3/T6, flag osteopata</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => {
                  const source = SOURCE_BADGE[alert.source] || SOURCE_BADGE.self_trigger;
                  const statusInfo = STATUS_BADGE[alert.status] || STATUS_BADGE.pending;
                  const patientName = alert.patients
                    ? `${alert.patients.first_name} ${alert.patients.last_name}`
                    : 'Paziente';
                  const patientLevel = alert.patients?.level
                    ? { level1: 'L1', level2: 'L2', level3: 'L3' }[alert.patients.level] || alert.patients.level
                    : '';
                  const clientName = alert.clients?.name || '—';
                  const date = new Date(alert.created_at).toLocaleDateString('it-IT', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  });

                  return (
                    <div key={alert.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{patientName}</span>
                            {patientLevel && (
                              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                {patientLevel}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{clientName} · {date}</div>
                          {alert.notes && (
                            <div className="mt-1 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1 italic">{alert.notes}</div>
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
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {alert.status !== 'confirmed_l1' && (
                          <button
                            onClick={() => changeStatus(alert.id, 'confirmed_l1')}
                            disabled={updating === alert.id}
                            className="text-xs px-3 py-1.5 rounded-xl bg-green-50 border border-green-300 text-green-700 font-semibold disabled:opacity-50"
                          >
                            ✅ Conferma → L1
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
                            ⏳ Da valutare
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  try {
    const [alerts, patients] = await Promise.all([
      getAllRestratAlerts(),
      getAllPatients(),
    ]);

    // Calcola buffer per azienda basato sui pazienti L1 attuali
    const clientMap = {};
    patients.forEach(p => {
      const cid = p.client_id;
      if (!clientMap[cid]) {
        clientMap[cid] = {
          client_id: cid,
          client_name: p.clients?.name || cid,
          l1_count: 0,
          l2_count: 0,
        };
      }
      if (p.level === 'level1') clientMap[cid].l1_count++;
      if (p.level === 'level2') clientMap[cid].l2_count++;
    });

    const bufferByClient = Object.values(clientMap)
      .filter(c => c.l1_count > 0 || c.l2_count > 0)
      .map(c => {
        const base_sessions = c.l1_count * (CONFIG.sessions_intensive + CONFIG.sessions_maintenance) * CONFIG.completion_rate;
        const buffer_sessions = Math.round(base_sessions * 0.15);
        const sessions_per_new_l1 = Math.round((CONFIG.sessions_intensive + CONFIG.sessions_maintenance) * CONFIG.completion_rate);
        const max_new_l1 = sessions_per_new_l1 > 0 ? Math.floor(buffer_sessions / sessions_per_new_l1) : 0;
        return { ...c, buffer_sessions, max_new_l1 };
      });

    return { props: { alerts, bufferByClient, dbError: null } };
  } catch {
    return { props: { alerts: [], bufferByClient: [], dbError: true } };
  }
});
