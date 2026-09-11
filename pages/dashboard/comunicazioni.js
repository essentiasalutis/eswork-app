import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import NavMenu from '../../components/NavMenu';
import { CATEGORIE_BREVI, STATI } from '../../lib/comunicazioni';

// Messaggi che le aziende mandano dal link HR, divisi per azienda.
// La risposta verso l'HR è STRUTTURATA: stato + eventuale data programmata. È
// l'unica cosa che l'HR rilegge dal suo link (mai il testo, né il suo né il tuo):
// per i dettagli si risponde a voce o per email. Vedi lib/comunicazioni.js.
export default function ComunicazioniPage() {
  const [items, setItems] = useState(null);
  const [avviso, setAvviso] = useState('');
  const [aperta, setAperta] = useState(null);
  const [filtro, setFiltro] = useState('aperte'); // aperte | tutte
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/comunicazioni');
    if (r.status === 401) { window.location.href = '/'; return; }
    const j = await r.json();
    setItems(j.comunicazioni || []); setAvviso(j.avviso || '');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function patch(id, body) {
    setErr('');
    const r = await fetch(`/api/admin/comunicazioni/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || 'Errore'); return; }
    const up = await r.json();
    setItems(prev => prev.map(x => (x.id === id ? { ...x, ...up } : x)));
    window.dispatchEvent(new Event('comunicazioni:aggiornate')); // pallino del menu
  }

  function apri(c) {
    setAperta(aperta === c.id ? null : c.id);
    if (!c.letta_at) patch(c.id, { letta: true }); // aprire = leggere
  }

  const visibili = (items || []).filter(c => filtro === 'tutte' || c.stato !== 'chiusa');
  const perAzienda = visibili.reduce((acc, c) => { (acc[c.cliente] = acc[c.cliente] || []).push(c); return acc; }, {});
  // Aziende con messaggi non letti in cima, poi la più recente.
  const aziende = Object.keys(perAzienda).sort((a, b) => {
    const na = perAzienda[a].some(c => !c.letta_at), nb = perAzienda[b].some(c => !c.letta_at);
    if (na !== nb) return na ? -1 : 1;
    return (perAzienda[b][0].created_at || '').localeCompare(perAzienda[a][0].created_at || '');
  });
  const nonLette = (items || []).filter(c => !c.letta_at).length;
  const dt = s => (s ? new Date(s).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <>
      <Head><title>Comunicazioni — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">←</Link>
              <h1 className="font-bold text-gray-900">Comunicazioni</h1>
              {nonLette > 0 && <span className="text-xs font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">{nonLette} da leggere</span>}
            </div>
            <NavMenu />
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Messaggi inviati dalle aziende dal link HR. L'HR vede solo lo <strong>stato</strong> che imposti qui (e la data, se programmata) — mai il testo.</p>
            <div className="flex gap-1 text-xs">
              {[['aperte', 'Aperte'], ['tutte', 'Tutte']].map(([v, l]) => (
                <button key={v} onClick={() => setFiltro(v)} className={`px-3 py-1.5 rounded-lg border ${filtro === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
              ))}
            </div>
          </div>
          {avviso && <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">{avviso}</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}
          {items === null && <div className="text-center text-gray-400 py-16 text-sm">Caricamento…</div>}
          {items && aziende.length === 0 && !avviso && (
            <div className="text-center text-gray-400 py-16 text-sm">{filtro === 'aperte' ? 'Nessuna comunicazione aperta.' : 'Nessuna comunicazione ricevuta.'}</div>
          )}

          {aziende.map(nome => (
            <section key={nome} className="bg-white rounded-2xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="font-semibold text-gray-900">{nome}</div>
                <Link href={`/dashboard/formazione/${perAzienda[nome][0].client_id}`} className="text-xs text-blue-600 hover:underline">Anagrafica e formazione →</Link>
              </div>
              <div className="divide-y divide-gray-100">
                {perAzienda[nome].map(c => (
                  <div key={c.id} className="px-5 py-3">
                    <button onClick={() => apri(c)} className="w-full flex items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        {!c.letta_at && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                        <span className={`text-sm ${c.letta_at ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>{CATEGORIE_BREVI[c.categoria] || c.categoria}</span>
                        <span className="text-xs text-gray-400 truncate">· {dt(c.created_at)}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${c.stato === 'chiusa' ? 'bg-gray-100 text-gray-500' : c.stato === 'programmata' ? 'bg-green-100 text-green-800' : c.stato === 'presa_in_carico' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {STATI[c.stato]}{c.stato === 'programmata' && c.data_programmata ? ` · ${new Date(`${c.data_programmata}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}
                      </span>
                    </button>
                    {aperta === c.id && (
                      <div className="mt-3 space-y-3">
                        <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3">{c.testo}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-500">Risposta all'HR:</span>
                          {Object.entries(STATI).map(([v, l]) => (
                            <button key={v} onClick={() => patch(c.id, { stato: v })}
                              className={`text-xs px-3 py-1.5 rounded-lg border ${c.stato === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>{l}</button>
                          ))}
                          {c.stato === 'programmata' && (
                            <input type="date" value={c.data_programmata || ''} onChange={e => patch(c.id, { data_programmata: e.target.value || null })}
                              className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg" />
                          )}
                          <button onClick={() => patch(c.id, { letta: false })} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">segna da leggere</button>
                        </div>
                        {c.categoria === 'postazione_nuova' && (
                          <p className="text-[11px] text-gray-500">Postazione nuova: studio a forfait + 5′ di formazione per ogni addetto, a consumo (Listino v2).</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => ({ props: {} }));
