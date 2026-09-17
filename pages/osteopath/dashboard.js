import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import { vistaPazienteLista } from '../../lib/vista';
import {
  getPatientsByProfessional,
  getWaitlistByProfessional,
  getClientById,
} from '../../lib/store';
import { programmaAttivo, ETICHETTA_CODA_NON_ATTIVA } from '../../lib/attivazione';

function Header({ proName }) {
  async function logout() {
    await fetch('/api/pro/auth/logout', { method: 'POST' });
    window.location.href = '/pro/login';
  }
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo-es.png" alt="Essentia Salutis" className="w-8 h-8 object-contain" />
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

export default function OsteopathDashboard({ proName, l1Patients, waitlist, allPatients }) {
  const pendingWaitlist = waitlist;

  return (
    <>
      <Head><title>Dashboard Osteopata — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <Header proName={proName} />

        <main className="max-w-4xl mx-auto px-5 py-6 space-y-6">
          {/* Stats rapide */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pazienti L1', value: l1Patients.length, color: '#0369a1' },
              { label: 'Pre-val. da fare', value: pendingWaitlist.length, color: pendingWaitlist.length > 0 ? '#ca8a04' : '#16a34a' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Pre-validazioni pendenti */}
          {pendingWaitlist.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">📋 Pre-validazioni da fare</div>
              <div className="space-y-2">
                {pendingWaitlist.map(w => (
                  <div key={w.id} className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-3 ${w.programma_non_attivo ? 'border-gray-200' : 'border-amber-200'}`}>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {w.patients?.first_name} {w.patients?.last_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {w.patients?.clients?.name || '—'} · {w.source === 'restratification' ? 'Ri-stratificazione' : 'Check-up'}
                      </div>
                      {w.notes && <div className="text-xs text-gray-400 italic mt-1">{w.notes}</div>}
                      {w.programma_non_attivo && (
                        <div className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 mt-2 inline-block">
                          ⏳ {ETICHETTA_CODA_NON_ATTIVA} — la presa in carico parte quando il programma viene avviato
                        </div>
                      )}
                    </div>
                    {w.programma_non_attivo ? (
                      <span className="text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl whitespace-nowrap">In attesa</span>
                    ) : (
                      <Link href={`/osteopath/prevalidation/${w.patient_id}`}
                        className="text-xs font-semibold text-white bg-amber-500 border border-amber-400 px-3 py-2 rounded-xl hover:bg-amber-600 whitespace-nowrap">
                        Avvia →
                      </Link>
                    )}
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
                      <div className="text-xs text-gray-500">{p.azienda || '—'}</div>
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

  const [patients, waitlist] = await Promise.all([
    getPatientsByProfessional(proId).catch(() => []),
    getWaitlistByProfessional(proId).catch(() => []),
  ]);

  // Proiezione (12/9): anche verso il curante escono solo i campi disegnati. Qui
  // viaggiavano cartelle complete e soprattutto i care_token dei suoi pazienti —
  // credenziali, non dati clinici: quelle non escono verso NESSUN browser, nemmeno
  // verso chi ha titolo a vedere i dati che aprono (regola di Enrico).
  const elenco = (patients || []).map(vistaPazienteLista);
  const l1Patients = elenco.filter(p => p.level === 'level1');

  // Coda di pre-validazione: le segnalazioni di aziende NON ancora attive non si
  // cancellano — restano dove sono, etichettate, così l'osteopata vede PERCHÉ sono
  // ferme e non chiama nessuno prima che il programma parta (Enrico, 13/9).
  const stati = new Map();
  for (const cid of new Set((waitlist || []).map(w => w.client_id).filter(Boolean))) {
    stati.set(cid, programmaAttivo(await getClientById(cid).catch(() => null)));
  }
  const codaEtichettata = (waitlist || []).map(w => ({
    ...w,
    programma_non_attivo: w.client_id ? !stati.get(w.client_id) : false,
  }));

  return {
    props: {
      proName,
      l1Patients,
      waitlist: codaEtichettata,
      allPatients: elenco,
    },
  };
});
