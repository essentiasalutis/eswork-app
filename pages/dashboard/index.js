import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getSessionToken, verifyToken } from '../../lib/auth';
import { getClients, getAssessmentCounts, getAllAcuteEvents } from '../../lib/store';
import { getDashboardFormazione } from '../../lib/org';
import NavMenu from '../../components/NavMenu';
import { TYPE_COLORS, TYPE_LABELS } from '../../lib/scoring';
import { etichettaData, ilGiorno } from '../../lib/checkup';

// Righe dell'agenda "Questa settimana": cosa c'è da fare e quando (e come si chiama
// quando la data è già passata).
const AGENDA = {
  ricontatto: { icona: '🔁', testo: 'Ricontattare', scaduto: 'Ricontatto in ritardo' },
  offerta: { icona: '⏳', testo: 'Offerta in scadenza', scaduto: 'Offerta scaduta' },
  checkup: { icona: '📋', testo: 'Check-up in chiusura', scaduto: '' },
};

export default function Dashboard({ clients: initialClients, assessmentCounts, pendingAcuteCount, formazioneAlerts = [], solleciti: sollecitiIniziali = [], sollecitiOfferta: sollecitiOffertaIniziali = [], agenda = [], oggi = '' }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [solleciti, setSolleciti] = useState(sollecitiIniziali);
  const [sollecitiOfferta, setSollecitiOfferta] = useState(sollecitiOffertaIniziali);

  // "Scrivi al referente": apre la posta con il testo pronto e segna il sollecito come
  // fatto, così sparisce. Se la segnatura fallisce il promemoria resta (meglio doppio che perso).
  async function segnaSollecito(s) {
    const r = await fetch(`/api/assessments/${s.assessment_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sollecito: s.tipo }),
    }).catch(() => null);
    if (r && r.ok) setSolleciti(prev => prev.filter(x => x.assessment_id !== s.assessment_id));
  }

  // Offerta a metà validità: stessa logica del sollecito del check-up.
  async function segnaSollecitoOfferta(s) {
    const r = await fetch(`/api/clients/${s.client_id}/offerta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'sollecitata' }),
    }).catch(() => null);
    if (r && r.ok) setSollecitiOfferta(prev => prev.filter(x => x.client_id !== s.client_id));
  }

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
        {agenda.length > 0 && (
          <div className="mb-5 bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-700 text-sm mb-2">📅 Questa settimana</h2>
            <div className="space-y-1">
              {agenda.map(v => {
                const t = AGENDA[v.tipo];
                const quando = v.scaduto ? `era ${ilGiorno(v.data)}` : v.data === oggi ? 'oggi' : etichettaData(v.data);
                return (
                  <Link key={`${v.tipo}-${v.client_id}`} href={v.tipo === 'checkup' ? `/dashboard/${v.client_id}` : '/dashboard/pipeline'}
                    className="flex items-center justify-between py-1.5 px-1 text-sm hover:bg-gray-50 rounded gap-2 flex-wrap">
                    <span className="flex items-center gap-2 min-w-0">
                      <span>{t.icona}</span>
                      <span className={`text-xs ${v.scaduto ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{v.scaduto ? t.scaduto : t.testo}</span>
                      <span className="font-medium text-gray-800 truncate">{v.cliente}</span>
                      {v.is_demo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">DEMO</span>}
                      {v.binario && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 text-white">{v.binario}</span>}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.scaduto ? 'bg-red-100 text-red-700' : v.data === oggi ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                      {quando}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {solleciti.length > 0 && (
          <div className="mb-5 bg-white rounded-2xl border border-amber-200 p-4">
            <h2 className="font-semibold text-gray-700 text-sm mb-2">📣 Check-up da sollecitare oggi</h2>
            <div className="space-y-1.5">
              {solleciti.map(s => {
                const pct = s.dipendenti > 0 ? Math.round((s.n / s.dipendenti) * 100) : null;
                const href = `mailto:${encodeURIComponent(s.email)}?subject=${encodeURIComponent(s.oggetto)}&body=${encodeURIComponent(s.corpo)}`;
                return (
                  <div key={s.assessment_id} className="flex items-center justify-between py-1.5 px-1 text-sm gap-2 flex-wrap">
                    <Link href={`/dashboard/${s.client_id}`} className="font-medium text-gray-800 hover:underline">{s.cliente}</Link>
                    <span className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-gray-600">{s.n}{s.dipendenti > 0 ? ` su ${s.dipendenti}` : ''} questionari{pct != null ? ` · ${pct}%` : ''}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${s.tipo === 'finale' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                        {s.giorni === 0 ? 'chiude oggi' : s.giorni === 1 ? 'chiude domani' : `chiude tra ${s.giorni} giorni`}
                      </span>
                      <a href={href} onClick={() => segnaSollecito(s)}
                        className="font-semibold text-white bg-gray-900 px-3 py-1 rounded-lg hover:bg-gray-700">✉️ Scrivi al referente</a>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {sollecitiOfferta.length > 0 && (
          <div className="mb-5 bg-white rounded-2xl border border-orange-200 p-4">
            <h2 className="font-semibold text-gray-700 text-sm mb-2">📣 Offerte da sollecitare oggi</h2>
            <div className="space-y-1.5">
              {sollecitiOfferta.map(s => {
                const href = `mailto:${encodeURIComponent(s.email)}?subject=${encodeURIComponent(s.oggetto)}&body=${encodeURIComponent(s.corpo)}`;
                return (
                  <div key={s.client_id} className="flex items-center justify-between py-1.5 px-1 text-sm gap-2 flex-wrap">
                    <span className="flex items-center gap-2">
                      <Link href={`/dashboard/${s.client_id}`} className="font-medium text-gray-800 hover:underline">{s.cliente}</Link>
                      {s.is_demo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">DEMO</span>}
                    </span>
                    <span className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-800">a metà validità · scade {s.scadeIl === oggi ? 'oggi' : `il ${etichettaData(s.scadeIl)}`}</span>
                      <a href={href} onClick={() => segnaSollecitoOfferta(s)}
                        className="font-semibold text-white bg-gray-900 px-3 py-1 rounded-lg hover:bg-gray-700">✉️ Scrivi al referente</a>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {formazioneAlerts.length > 0 && (
          <div className="mb-5 bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-700 text-sm mb-2">📚 Formazione — nuovi ingressi da recuperare</h2>
            <div className="space-y-1.5">
              {formazioneAlerts.map(a => (
                <Link key={a.client_id} href={`/dashboard/formazione/${a.client_id}`}
                  className="flex items-center justify-between py-1.5 px-1 text-sm text-gray-600 hover:bg-gray-50 rounded gap-2 flex-wrap">
                  <span className="font-medium text-gray-800">{a.name}</span>
                  <span className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="text-gray-500">{a.nInAttesa} in attesa</span>
                    {a.active
                      ? <span className="font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">⏰ {a.motivo === 'soglia' ? 'soglia raggiunta' : 'scaduto (6 mesi)'}</span>
                      : <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">scade tra {a.giorniAllaScadenza}gg</span>}
                    {a.prossimaCampagna && <span className="text-gray-400">campagna: {new Date(a.prossimaCampagna).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>}
                    <span className="text-blue-600 font-medium">Apri →</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800">Aziende clienti</h1>
          <button
            onClick={() => router.push('/dashboard/first-meeting?modo=rapido')}
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
                      <div className="font-semibold text-gray-900 text-base truncate">
                        {c.name}
                        {c.is_demo && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 align-middle">DEMO</span>}
                        {c.binario && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-900 text-white align-middle">{c.binario}</span>}
                        {c.binario === 'B' && !['inviata', 'firmata'].includes(c.lettera_stato) && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 align-middle">Lettera da inviare</span>}
                      </div>
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

export const getServerSideProps = require('../../lib/auth').requireAuthSsr(async (ctx) => {
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

  let formazioneAlerts = [];
  try { formazioneAlerts = await getDashboardFormazione(new Date().toISOString().slice(0, 10)); } catch (_) {}

  let solleciti = [];
  try {
    const { getSollecitiCheckup } = await import('../../lib/checkup-server');
    // Il link nella mail = l'indirizzo da cui Enrico sta usando la piattaforma (come la
    // scheda azienda con window.location), non una variabile d'ambiente da tenere allineata.
    const h = (ctx && ctx.req && ctx.req.headers) || {};
    const host = h['x-forwarded-host'] || h.host;
    const proto = h['x-forwarded-proto'] || (host && /^localhost|^127\./.test(host) ? 'http' : 'https');
    solleciti = await getSollecitiCheckup({ baseUrl: host ? `${proto}://${host}` : 'https://eswork-app.vercel.app' });
  } catch (_) {}

  // Agenda della settimana: ricontatti "Non ora", offerte aperte in scadenza, check-up
  // che chiudono. Le date già passate restano in cima, in rosso (lib/pipeline.js).
  let agenda = [];
  let oggi = '';
  try {
    const { oggiRoma, aggiungiGiorni } = await import('../../lib/checkup');
    const { agendaSettimana } = await import('../../lib/pipeline');
    const { getCheckupInChiusura } = await import('../../lib/checkup-server');
    oggi = oggiRoma();
    const checkups = await getCheckupInChiusura({ oggi, limite: aggiungiGiorni(oggi, 7) });
    agenda = agendaSettimana({ clients, checkups, oggi });
  } catch (_) {}

  // Offerte arrivate a metà validità e non ancora sollecitate (lib/offerta.js).
  let sollecitiOfferta = [];
  try {
    const { sollecitoOffertaDovuto, testoSollecitoOfferta } = await import('../../lib/offerta');
    sollecitiOfferta = clients.filter(c => sollecitoOffertaDovuto(c, oggi)).map(c => ({
      client_id: c.id, cliente: c.name, is_demo: !!c.is_demo, email: c.contact_email || '', scadeIl: c.offerta_scade_il,
      ...testoSollecitoOfferta({ azienda: c.name, referente: c.contact_name, inviataIl: c.offerta_aperta_il, scadeIl: c.offerta_scade_il }),
    }));
  } catch (_) {}

  return { props: { clients, assessmentCounts, pendingAcuteCount, formazioneAlerts, solleciti, sollecitiOfferta, agenda, oggi } };
});
