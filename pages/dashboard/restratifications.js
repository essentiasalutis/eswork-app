import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getAllRestratAlerts, getAllPatients, getTreatmentCapacity } from '../../lib/store';
import { PROTOCOLLO, percento } from '../../lib/protocollo.mjs';
import NavMenu from '../../components/NavMenu';
import { dataIt } from '../../lib/date-it.mjs';

// Sedute per un nuovo L1 (regola del protocollo)

// Fonte: tutti grigi/neutri — è solo informazione su chi ha segnalato
const SOURCE_BADGE = {
  self_trigger: { label: 'Dipendente',  cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  checkpoint:   { label: 'Checkpoint', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  osteopath:    { label: 'Osteopata',  cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// Status: colore = azione richiesta
const STATUS_BADGE = {
  pending:       { label: '⚠️ Da valutare',    cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  confirmed_l1:  { label: '✅ Promosso L1',    cls: 'bg-green-100 text-green-800 border-green-200' },
  not_confirmed: { label: 'Non confermato',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// Posti per i nuovi Livello 1 (Enrico, 30/9): la stessa barra del box nella scheda.
function PostiBar({ presi, posti }) {
  const pct = posti > 0 ? Math.min(100, Math.round((presi / posti) * 100)) : 0;
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#ca8a04' : '#16a34a';
  return (
    <div className="mt-3">
      <div className="text-xs text-gray-500 mb-1">{presi} presi su {posti}</div>
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

  const pendingCount = alerts.filter(a => a.status === 'pending').length;

  return (
    <>
      <Head><title>Ri-stratificazioni — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
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
            <NavMenu />
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          {dbError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
              <strong>⚠️ Migrazione SQL mancante.</strong> Esegui <code className="bg-amber-100 px-1 rounded">supabase-schema-v11-restratification.sql</code> nel SQL Editor di Supabase per attivare questa sezione.
            </div>
          )}

          {/* ── Legenda ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Legenda</div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex gap-3">
                <span className="mt-0.5 text-orange-500 text-base">⚠️</span>
                <div>
                  <div className="font-semibold text-gray-800">Da valutare</div>
                  <div className="text-xs text-gray-500">È arrivato un segnale (dal dipendente, dal checkpoint o dall'osteopata). Devi decidere se promuovere questo dipendente a Livello 1.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 text-green-600 text-base">✅</span>
                <div>
                  <div className="font-semibold text-gray-800">Promosso L1</div>
                  <div className="text-xs text-gray-500">Hai confermato il passaggio a trattamento attivo. Questo dipendente consuma uno dei posti per i nuovi ingressi dell'azienda.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 text-gray-400 text-base">✖</span>
                <div>
                  <div className="font-semibold text-gray-800">Non confermato</div>
                  <div className="text-xs text-gray-500">Il segnale è stato valutato ma non richiede un cambio di livello. Non consuma posti.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 text-gray-500 text-base">📊</span>
                <div>
                  <div className="font-semibold text-gray-800">Posti per i nuovi ingressi</div>
                  <div className="text-xs text-gray-500">Il {percento(PROTOCOLLO.nuovi_l1_pct)} dei dipendenti, per eccesso, ogni anno di programma: sono nel prezzo, ognuno un percorso di trattamento. Li consumano autosegnalazioni prese in carico e promozioni a Livello 1. Finiti i posti, ogni nuovo Livello 1 è fuori contratto.</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Posti per i nuovi L1, per azienda (stessa funzione della scheda) ── */}
          {bufferByClient && bufferByClient.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Posti per i nuovi ingressi, per azienda
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {bufferByClient.map(c => (
                  <div key={c.client_id} className={`bg-white rounded-2xl border p-4 ${c.presi > c.posti ? 'border-red-300' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{c.client_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.posti} posti · {percento(PROTOCOLLO.nuovi_l1_pct)} di {c.dipendenti} dipendenti</div>
                      </div>
                      <div className={`text-right shrink-0 ${c.presi > c.posti ? 'text-red-600' : c.disponibili === 0 ? 'text-amber-600' : 'text-green-700'}`}>
                        <div className="text-2xl font-bold leading-none">{c.presi > c.posti ? `−${c.presi - c.posti}` : c.disponibili}</div>
                        <div className="text-xs font-medium">{c.presi > c.posti ? 'oltre i posti' : c.disponibili === 1 ? 'disponibile' : 'disponibili'}</div>
                      </div>
                    </div>
                    <PostiBar presi={c.presi} posti={c.posti} />
                  </div>
                ))}
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
                  const date = dataIt(alert.created_at, { day: '2-digit', month: 'short', year: 'numeric' });

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

    // Posti per i nuovi L1, per azienda: la stessa funzione del box nella scheda
    // (lib/store.js getTreatmentCapacity), per le aziende con persone dal check-up.
    const aziende = {};
    patients.forEach(p => { if (!aziende[p.client_id]) aziende[p.client_id] = p.clients?.name || p.client_id; });
    const bufferByClient = (await Promise.all(Object.entries(aziende).map(async ([client_id, client_name]) => {
      const c = await getTreatmentCapacity(client_id).catch(() => null);
      return c && c.posti > 0 ? { client_id, client_name, posti: c.posti, presi: c.presi, disponibili: c.disponibili, dipendenti: c.dipendenti } : null;
    }))).filter(Boolean);

    return { props: { alerts, bufferByClient, dbError: null } };
  } catch {
    return { props: { alerts: [], bufferByClient: [], dbError: true } };
  }
});
