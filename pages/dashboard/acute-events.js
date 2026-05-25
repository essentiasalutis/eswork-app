import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { getAllAcuteEvents, updateAcuteEvent } from '../../lib/store';

const STATUS_LABELS = {
  pending: 'In attesa',
  contacted: 'Contattato',
  resolved: 'Risolto',
  escalated: 'Escalation',
};

const STATUS_COLORS = {
  pending: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  contacted: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  resolved: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  escalated: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
};

function hoursRemaining(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline) - Date.now();
  const hours = Math.round(diff / (1000 * 60 * 60));
  return hours;
}

export default function AcuteEventsPage({ events: initialEvents }) {
  const [events, setEvents] = useState(initialEvents || []);
  const [updating, setUpdating] = useState(null);

  async function updateStatus(id, newStatus) {
    setUpdating(id);
    const now = new Date().toISOString();
    const fields = { status: newStatus };
    if (newStatus === 'contacted') fields.contacted_at = now;
    if (newStatus === 'resolved') fields.resolved_at = now;
    try {
      const res = await fetch(`/api/acute-events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const updated = await res.json();
        setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
      }
    } catch (e) {
      console.error(e);
    }
    setUpdating(null);
  }

  const nrsColor = (nrs) => {
    if (nrs === null || nrs === undefined) return '#6b7280';
    if (nrs <= 3) return '#16a34a';
    if (nrs <= 6) return '#ca8a04';
    return '#dc2626';
  };

  return (
    <>
      <Head><title>Eventi acuti — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Eventi acuti</div>
              <div className="text-xs text-gray-500">
                {events.filter(e => e.status === 'pending').length} in attesa
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-6">
          {events.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">✅</div>
              <p>Nessun evento acuto registrato.</p>
            </div>
          )}

          <div className="space-y-3">
            {events.map(e => {
              const sc = STATUS_COLORS[e.status] || STATUS_COLORS.pending;
              const hrs = e.status === 'pending' ? hoursRemaining(e.escalation_deadline) : null;
              const patientName = e.patients ? `${e.patients.first_name} ${e.patients.last_name}` : '—';
              const clientName = e.clients?.name || '—';

              return (
                <div key={e.id} className={`bg-white rounded-2xl border ${e.status === 'pending' ? 'border-red-200' : 'border-gray-200'} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{patientName}</span>
                        <span className="text-xs text-gray-400">{clientName}</span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        {e.nrs !== null && e.nrs !== undefined && (
                          <span className="text-sm font-bold" style={{ color: nrsColor(e.nrs) }}>
                            NRS {e.nrs}/10
                          </span>
                        )}
                        {e.pain_zone && (
                          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{e.pain_zone}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(e.reported_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {e.description && (
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mb-2">{e.description}</p>
                      )}

                      {hrs !== null && (
                        <div className={`text-xs font-medium rounded-lg px-2 py-1 inline-block ${hrs <= 0 ? 'bg-red-100 text-red-700' : hrs <= 4 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                          {hrs <= 0
                            ? `Escalation scaduta ${Math.abs(hrs)} ore fa`
                            : `Escalation tra ${hrs} ore`}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>
                        {STATUS_LABELS[e.status]}
                      </span>

                      {e.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(e.id, 'contacted')}
                          disabled={updating === e.id}
                          className="text-xs px-3 py-1.5 rounded-xl bg-amber-500 text-white font-semibold disabled:opacity-60"
                        >
                          Segna contattato
                        </button>
                      )}
                      {e.status === 'contacted' && (
                        <button
                          onClick={() => updateStatus(e.id, 'resolved')}
                          disabled={updating === e.id}
                          className="text-xs px-3 py-1.5 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-60"
                        >
                          Segna risolto
                        </button>
                      )}
                      {(e.status === 'pending' || e.status === 'contacted') && (
                        <button
                          onClick={() => updateStatus(e.id, 'escalated')}
                          disabled={updating === e.id}
                          className="text-xs px-3 py-1.5 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-60"
                        >
                          Escalation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = require('../../lib/auth').requireAuthSsr(async () => {
  let events = [];
  try {
    events = await getAllAcuteEvents();
  } catch (_) {
    events = [];
  }
  return { props: { events } };
});
