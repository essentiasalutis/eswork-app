// Sezione «Sportello» — la pagina del lunedì mattina (Enrico, 28/9): la settimana di
// tutte le aziende, l'agenda di ogni osteopata (lì si vedono i conflitti) e tutti gli
// allarmi in un posto solo. Stessi dati della scheda azienda (lib/sportello-server.js).
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';
import NavMenu from '../../components/NavMenu';
import { ListaAllarmi, ModuloGiornata, RigaGiornata, ContrattoErogato, PersoneInCarico, giornoBreve, giornoSettimana } from '../../components/sportello/Sportello';
import { aggiungiGiorniG } from '../../lib/sportello.mjs';

function lunediDi(giorno) {
  const d = new Date(`${giorno}T12:00:00Z`).getUTCDay();   // 0 = domenica
  return aggiungiGiorniG(giorno, d === 0 ? -6 : 1 - d);
}

export default function SportelloPage({ oggi }) {
  const router = useRouter();
  const lunedi = /^\d{4}-\d{2}-\d{2}$/.test(String(router.query.settimana || '')) ? lunediDi(router.query.settimana) : lunediDi(oggi);
  const domenica = aggiungiGiorniG(lunedi, 6);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [nuova, setNuova] = useState(!!router.query.nuova);

  const carica = useCallback(async () => {
    const r = await fetch(`/api/sportello?da=${lunedi}&a=${domenica}`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setErr(j.error || 'Dati non disponibili.'); setD(null); return; }
    setErr(''); setD(j);
  }, [lunedi, domenica]);
  useEffect(() => { carica(); }, [carica]);

  const vai = (giorno) => router.push({ pathname: '/dashboard/sportello', query: { settimana: giorno } }, undefined, { shallow: true });
  const giorni = Array.from({ length: 7 }, (_, i) => aggiungiGiorniG(lunedi, i));

  return (
    <>
      <Head><title>Sportello — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">←</Link>
            <div>
              <div className="font-semibold text-gray-900">Sportello</div>
              <div className="text-xs text-gray-500">Giornate di tutte le aziende, agenda degli osteopati, allarmi</div>
            </div>
            <NavMenu />
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          {err && <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-900">{err}</div>}

          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Allarmi</div>
            {d ? <ListaAllarmi allarmi={d.allarmi} vuoto="Nessun allarme: giornate piene, ritmi in regola, autosegnalazioni gestite." /> : <div className="text-sm text-gray-400">{err ? '—' : 'Caricamento…'}</div>}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Settimana dal {giornoBreve(lunedi)} al {giornoBreve(domenica)}</div>
              <div className="ml-auto flex gap-2 text-sm">
                <button onClick={() => vai(aggiungiGiorniG(lunedi, -7))} className="px-3 py-1.5 border border-gray-300 rounded-lg">← Precedente</button>
                <button onClick={() => vai(oggi)} className="px-3 py-1.5 border border-gray-300 rounded-lg">Questa settimana</button>
                <button onClick={() => vai(aggiungiGiorniG(lunedi, 7))} className="px-3 py-1.5 border border-gray-300 rounded-lg">Successiva →</button>
                <button onClick={() => setNuova(n => !n)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white font-semibold">+ Nuova giornata</button>
              </div>
            </div>
            {nuova && d && (
              <div className="mb-4">
                <ModuloGiornata nuova scelte={d.scelte} iniziale={{ client_id: router.query.nuova || '', data: oggi }}
                  onFatto={() => { setNuova(false); carica(); }} onAnnulla={() => setNuova(false)} />
              </div>
            )}
            {d && (
              <div className="space-y-4">
                {giorni.map(g => {
                  const delGiorno = d.giornate.filter(x => x.data === g);
                  return (
                    <div key={g}>
                      <div className={`text-sm font-semibold mb-1.5 ${g === oggi ? 'text-green-700' : 'text-gray-700'}`}>{giornoSettimana(g)} {giornoBreve(g)}{g === oggi ? ' · oggi' : ''}</div>
                      {delGiorno.length
                        ? <div className="space-y-1.5">{delGiorno.map(x => <RigaGiornata key={x.id} g={x} scelte={d.scelte} onCambio={carica} />)}</div>
                        : <div className="text-xs text-gray-400">Nessuna giornata.</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {d && (
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Agenda degli osteopati — questa settimana</div>
              {d.agenda.length ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {d.agenda.map(o => (
                    <div key={o.id} className="border border-gray-200 rounded-xl p-3">
                      <div className="font-semibold text-gray-900 mb-1.5">{o.nome}</div>
                      <ul className="space-y-1 text-sm">
                        {o.giornate.map(g => (
                          <li key={g.id} className={g.conflitto ? 'text-red-700 font-semibold' : 'text-gray-700'}>
                            {giornoSettimana(g.data)} {giornoBreve(g.data)} · {g.ora_inizio}–{g.ora_fine} · {g.azienda}{g.conflitto ? ' · sovrapposta' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-gray-500">Nessun osteopata con giornate in questa settimana.</div>}
            </section>
          )}

          {d && (
            <section className="space-y-4">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Programmi attivi — sedute e percorsi</div>
              {d.aziende.length ? d.aziende.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <div className="flex items-baseline gap-3">
                    <Link href={`/dashboard/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{c.nome}</Link>
                    <span className="text-xs text-gray-400">{c.dataAvvio ? `avvio ${giornoBreve(c.dataAvvio)}` : 'data di avvio del programma non impostata'}</span>
                  </div>
                  <ContrattoErogato azienda={c} />
                  <PersoneInCarico persone={c.persone} />
                </div>
              )) : <div className="text-sm text-gray-500">Nessun programma attivo.</div>}
            </section>
          )}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  const { giornoIt } = await import('../../lib/date-it.mjs');
  return { props: { oggi: giornoIt(new Date()) } };
});
