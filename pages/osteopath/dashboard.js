import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import {
  getPatientsByProfessional,
  getAcuteEventsByProfessional,
  getWaitlistByProfessional,
} from '../../lib/store';

function Header({ proName }) {
  async function logout() {
    await fetch('/api/pro/auth/logout', { method: 'POST' });
    window.location.href = '/pro/login';
  }
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">🌿</div>
          <div>
            <span className="font-bold text-gray-900">ES Work</span>
            <span className="text-xs text-gray-400 ml-2">area osteopata</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">{proName}</span>
          <button onClick={logout} className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50">Esci</button>
        </div>
      </div>
    </header>
  );
}

function Badge({ label, color }) {
  const colors = {
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[color] || colors.gray}`}>{label}</span>
  );
}

const LEVEL_LABEL = { level1: 'L1', level2: 'L2', level3: 'L3' };

export default function OsteopathDashboard({ proName, l1Patients, acuteEvents, waitlist, allPatients }) {
  const pendingAcute = acuteEvents.filter(e => e.status === 'pending');
  const pendingWaitlist = waitlist;

  return (
    <>
      <Head><title>Dashboard Osteopata — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <Header proName={proName} />

        <main className="max-w-4xl mx-auto px-5 py-6 space-y-6">
          {/* Stats rapide */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pazienti L1', value: l1Patients.length, color: '#0369a1' },
              { label: 'Acuti pending', value: pendingAcute.length, color: pendingAcute.length > 0 ? '#dc2626' : '#16a34a' },
              { label: 'Pre-val. da fare', value: pendingWaitlist.length, color: pendingWaitlist.length > 0 ? '#ca8a04' : '#16a34a' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Alert eventi acuti */}
          {pendingAcute.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">🚨 Eventi acuti da gestire</div>
              <div className="space-y-2">
                {pendingAcute.map(ev => {
                  const deadline = ev.escalation_deadline ? new Date(ev.escalation_deadline) : null;
                  const hoursLeft = deadline ? Math.round((deadline - Date.now()) / 3600000) : null;
                  const isOverdue = hoursLeft != null && hoursLeft <= 0;
                  return (
                    <div key={ev.id} className={`bg-white rounded-2xl border p-4 ${isOverdue ? 'border-red-300' : 'border-orange-200'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">
                            {ev.patients?.first_name} {ev.patients?.last_name}
                          </div>
                          <div className="text-xs text-gray-500">{ev.clients?.name} · NRS {ev.nrs ?? '—'} · {ev.pain_zone || 'zona n.d.'}</div>
                          {ev.description && <div className="text-xs text-gray-400 mt-1 italic">{ev.description.slice(0, 100)}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          {hoursLeft != null && (
                            <div className={`text-xs font-bold ${isOverdue ? 'text-red-600' : hoursLeft < 6 ? 'text-orange-600' : 'text-gray-500'}`}>
                              {isOverdue ? '⚠️ Scaduto' : `⏱ ${hoursLeft}h rimaste`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pre-validazioni pendenti */}
          {pendingWaitlist.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">📋 Pre-validazioni da fare</div>
              <div className="space-y-2">
                {pendingWaitlist.map(w => (
                  <div key={w.id} className="bg-white rounded-2xl border border-amber-200 p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {w.patients?.first_name} {w.patients?.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {w.patients?.clients?.name || '—'} · {w.source === 'restratification' ? 'Ri-stratificazione' : 'Assessment'}
                      </div>
                      {w.notes && <div className="text-xs text-gray-400 italic mt-1">{w.notes}</div>}
                    </div>
                    <Link href={`/osteopath/prevalidation/${w.patient_id}`}
                      className="text-xs font-semibold text-white bg-amber-500 border border-amber-400 px-3 py-2 rounded-xl hover:bg-amber-600 whitespace-nowrap">
                      Avvia →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pazienti L1 in trattamento */}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">💪 Pazienti L1 in trattamento</div>
            {l1Patients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
                Nessun paziente L1 assegnato al momento
              </div>
            ) : (
              <div className="space-y-2">
                {l1Patients.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-gray-500">{p.clients?.name || '—'}</div>
                      {p.level_status === 'opted_out' && (
                        <span className="text-xs text-gray-400 italic">Percorso completato</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge label={`Ciclo ${p.current_cycle || 0}`} color="blue" />
                      <Link href={`/osteopath/patient/${p.id}`}
                        className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100">
                        Scheda →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link rapidi */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/pro/dashboard" className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-300 transition-colors">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-sm font-semibold text-gray-700">Area professionale</div>
              <div className="text-xs text-gray-400">Cartelle pazienti</div>
            </Link>
            <Link href="/pro/dashboard" className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-green-300 transition-colors">
              <div className="text-2xl mb-1">📅</div>
              <div className="text-sm font-semibold text-gray-700">Agenda</div>
              <div className="text-xs text-gray-400">Prossime sessioni</div>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const proId = ctx.req.proSession.proId;
  const proName = ctx.req.proSession.proName;

  const [patients, acuteEvents, waitlist] = await Promise.all([
    getPatientsByProfessional(proId).catch(() => []),
    getAcuteEventsByProfessional(proId).catch(() => []),
    getWaitlistByProfessional(proId).catch(() => []),
  ]);

  const l1Patients = patients.filter(p => p.level === 'level1');

  return {
    props: {
      proName,
      l1Patients,
      acuteEvents,
      waitlist,
      allPatients: patients,
    },
  };
});
