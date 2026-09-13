// ─────────────────────────────────────────────────────────────────────────────
// «👥 Dipendenti» — l'anagrafica organizzativa dell'azienda, pagina propria.
//
// Decisione di Enrico (13/9): l'anagrafica non è un dettaglio della formazione.
// Serve a tre cose diverse — gli inviti clinici dei nuovi assunti, l'ergonomia
// nominativa e il numero di persone, che è il denominatore di tutto ciò che
// raccontiamo all'azienda. Sta quindi accanto a Formazione, non dentro.
//
// Le due pagine restano collegate (la coda dei recuperi legge questi nomi): in
// cima a ciascuna c'è il link all'altra, e la coda dei nuovi ingressi si GENERA
// solo di là, dove vive la sessione formativa.
//
// Dominio ORGANIZZATIVO: qui non entra nulla di clinico. Il percorso del paziente
// non compare e non è collegabile a questa anagrafica.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../../lib/auth';
import { storicoDipendente, TIPO_ERGONOMIA } from '../../../lib/org-regole.mjs';

const fmt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Stato base del dipendente (calcolato client-side dalle partecipazioni).
function statoBase(dipId, parts) {
  const p = parts.filter(x => x.dipendente_id === dipId && (x.tipo === 'base' || x.tipo === 'base_concentrata'));
  const svolta = p.find(x => x.stato === 'svolta');
  if (svolta) return { label: '✓ svolta', cls: 'text-green-700', data: svolta.data_svolgimento };
  if (p.some(x => x.stato === 'pianificata')) return { label: '◷ pianificata', cls: 'text-amber-700' };
  return { label: '— pendente', cls: 'text-red-600' };
}

export default function DipendentiPage({ clientId }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [params, setParams] = useState(null);
  const [nuovo, setNuovo] = useState({ nome: '', data_ingresso: '', matricola: '', area: '' });
  const [importTxt, setImportTxt] = useState('');
  const [invitoLinks, setInvitoLinks] = useState({}); // link /invito generati in-sessione (plaintext MAI persistito)
  const [apertoId, setApertoId] = useState(null);     // riga con lo storico aperto
  const [cerca, setCerca] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/org/${clientId}`);
    if (!r.ok) { setErr('Errore di caricamento'); return; }
    const j = await r.json(); setSt(j); setParams(j.params);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  async function call(method, path, body, key) {
    setBusy(key || path); setErr('');
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || j.motivo || 'Errore'); setBusy(''); return null; }
      await load(); setBusy(''); return j;
    } catch (e) { setErr('Errore di rete'); setBusy(''); return null; }
  }

  if (!st) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">{err || 'Caricamento…'}</div>;

  const { dipendenti, partecipazioni, sessioni, duplicati, coda } = st;
  const q = cerca.trim().toLowerCase();
  const dipendentiMostrati = q ? dipendenti.filter(d => `${d.nome || ''} ${d.matricola || ''}`.toLowerCase().includes(q)) : dipendenti;
  const nomeById = Object.fromEntries(dipendenti.map(d => [d.id, d.nome]));
  const attivi = dipendenti.filter(d => d.attivo).length;

  async function addDip(e) {
    e.preventDefault();
    if (!nuovo.nome.trim()) return;
    const r = await call('POST', `/api/org/${clientId}/dipendenti`, nuovo, 'add');
    if (r) setNuovo({ nome: '', data_ingresso: '', matricola: '', area: '' });
  }
  async function doImport() {
    const lista = importTxt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [nome, data_ingresso, matricola] = l.split(/[;,\t]/).map(s => s && s.trim());
      return { nome, data_ingresso: data_ingresso || null, matricola: matricola || null };
    }).filter(x => x.nome);
    const r = await call('POST', `/api/org/${clientId}/import`, { lista }, 'import');
    if (r) setImportTxt('');
  }

  // Invito clinico del neoassunto. Il token torna in chiaro UNA volta → lo tengo in
  // invitoLinks (non è persistito). Su guardia 409 (già completato/consumato) chiedo
  // conferma ESPLICITA per l'override (recupero-errore: nuova cartella scollegata).
  async function genInvito(d, override = false) {
    setBusy('inv_' + d.id); setErr('');
    try {
      const r = await fetch(`/api/org/${clientId}/invito`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dipendente_id: d.id, action: 'genera', override }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 && !override) {
        const msg = j.error === 'GIA_COMPLETATO' ? `${d.nome} ha già completato il check-up.` : `${d.nome} ha già un invito consumato.`;
        setBusy('');
        if (confirm(`${msg}\n\nProcedere è un RECUPERO ECCEZIONALE: crea una NUOVA cartella clinica scollegata dalla precedente. Continuare?`)) return genInvito(d, true);
        return;
      }
      if (!r.ok) { setErr(j.error || 'Errore'); setBusy(''); return; }
      if (j.token) setInvitoLinks(m => ({ ...m, [d.id]: `${window.location.origin}/invito/${j.token}` }));
      await load(); setBusy('');
    } catch { setErr('Errore di rete'); setBusy(''); }
  }
  async function revInvito(d) {
    if (!confirm(`Revocare l'invito di ${d.nome}? Il link smetterà di funzionare.`)) return;
    await call('POST', `/api/org/${clientId}/invito`, { dipendente_id: d.id, action: 'revoca' }, 'inv_' + d.id);
    setInvitoLinks(m => { const n = { ...m }; delete n[d.id]; return n; });
  }

  const box = 'bg-white rounded-2xl border border-gray-200 p-4';
  const inputCls = 'px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <>
      <Head><title>Dipendenti — {params.name} — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href={`/dashboard/${clientId}`} className="text-gray-400 hover:text-gray-700">←</Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900">👥 Dipendenti · {params.name}</h1>
              <p className="text-xs text-gray-500">{attivi} in forza · {params.employees} dichiarati nella scheda · dati organizzativi (solo titolare)</p>
            </div>
            <Link href={`/dashboard/formazione/${clientId}`} className="text-sm text-green-700 border border-green-200 bg-green-50 px-3 py-2 rounded-xl whitespace-nowrap">📚 Formazione</Link>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-5 py-6 space-y-5">
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

          {/* Il numero in forza e quello dichiarato nella scheda devono coincidere:
              è il denominatore di tutto quello che l'azienda legge. */}
          {attivi > 0 && parseInt(params.employees) !== attivi && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-900">
              In anagrafica risultano <strong>{attivi}</strong> dipendenti in forza, nella scheda azienda ne sono dichiarati <strong>{params.employees}</strong>.
              {' '}<Link href={`/dashboard/${clientId}`} className="underline font-semibold">Allinea dalla scheda azienda →</Link>
            </div>
          )}

          {/* La coda dei nuovi ingressi si GENERA in Formazione (è una sessione
              formativa): qui solo il richiamo, per non avere due pulsanti che fanno
              la stessa cosa in due punti diversi. */}
          {coda.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 flex items-center justify-between gap-3 flex-wrap">
              <span>🆕 <strong>{coda.length}</strong> {coda.length === 1 ? 'nuovo ingresso in attesa' : 'nuovi ingressi in attesa'} di recupero formativo.</span>
              <Link href={`/dashboard/formazione/${clientId}`} className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl">Vai alla formazione →</Link>
            </div>
          )}

          {/* Accesso HR (link pubblico sola-scrittura, revocabile) */}
          <details className={box}>
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">🔗 Accesso HR — link &quot;Aggiungi nuovo ingresso&quot;</summary>
            <p className="text-xs text-gray-500 mt-2">Link pubblico per l&apos;HR dell&apos;azienda: SOLA scrittura (aggiunge ingressi). Non legge nomi né stato formativo. Revocabile: se sospetti che il link sia in giro, rigeneralo o revocalo.</p>
            {params.hr_ingressi_token ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">● attivo</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 min-w-0 truncate">{`${typeof window !== 'undefined' ? window.location.origin : ''}/hr/${params.hr_ingressi_token}`}</code>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/hr/${params.hr_ingressi_token}`); }} className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg">Copia</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => call('POST', `/api/org/${clientId}/hr-token`, { action: 'genera' }, 'hrgen')} disabled={busy === 'hrgen'} className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">↻ Rigenera (chiude il vecchio)</button>
                  <button onClick={() => { if (confirm('Revocare il link HR? Il vecchio link smetterà di funzionare.')) call('POST', `/api/org/${clientId}/hr-token`, { action: 'revoca' }, 'hrrev'); }} disabled={busy === 'hrrev'} className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">Revoca</button>
                </div>
              </div>
            ) : (
              <button onClick={() => call('POST', `/api/org/${clientId}/hr-token`, { action: 'genera' }, 'hrgen')} disabled={busy === 'hrgen'} className="mt-3 text-sm font-semibold text-white bg-gray-800 px-4 py-2 rounded-xl disabled:opacity-50">Genera link HR</button>
            )}
          </details>

          {/* Coda duplicati */}
          {duplicati.length > 0 && (
            <div className={`${box} border-amber-300`}>
              <h2 className="font-bold text-gray-900">⚠️ Possibili duplicati ({duplicati.length})</h2>
              <p className="text-xs text-gray-500 mb-2">Avviso non bloccante. Conferma se sono persone diverse, oppure unisci (disattiva il nuovo record).</p>
              {duplicati.map(dp => (
                <div key={dp.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm gap-2 flex-wrap">
                  <span><strong>{nomeById[dp.dipendente_id] || dp.dipendente_id}</strong> ≈ {nomeById[dp.match_dipendente_id] || dp.match_dipendente_id} <span className="text-xs text-gray-400">({dp.match_tipo === 'forte_matricola' ? 'matricola uguale' : 'nome+data'})</span></span>
                  <span className="flex gap-2">
                    <button onClick={() => call('PUT', `/api/org/duplicati/${dp.id}`, { azione: 'distinto' }, dp.id)} className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg">Persone diverse</button>
                    <button onClick={() => call('PUT', `/api/org/duplicati/${dp.id}`, { azione: 'unisci' }, dp.id)} className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">Unisci</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Anagrafica */}
          <div className={box}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="font-bold text-gray-900">👥 Anagrafica ({dipendenti.length})</h2>
              <div className="flex gap-2">
                <a href={`/api/org/${clientId}/export`} className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-200">⬇ Esporta CSV</a>
                <button onClick={() => call('POST', `/api/org/${clientId}/seed`, {}, 'seed')} disabled={busy === 'seed'} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl disabled:opacity-50">Importa nomi dal check-up</button>
              </div>
            </div>
            <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca per nome o matricola…" className={`${inputCls} w-full mb-3`} />
            <form onSubmit={addDip} className="flex gap-2 flex-wrap mb-3">
              <input placeholder="Nome e cognome *" value={nuovo.nome} onChange={e => setNuovo(n => ({ ...n, nome: e.target.value }))} className={inputCls} />
              <input type="date" value={nuovo.data_ingresso} onChange={e => setNuovo(n => ({ ...n, data_ingresso: e.target.value }))} className={inputCls} />
              <input placeholder="Matricola (opz.)" value={nuovo.matricola} onChange={e => setNuovo(n => ({ ...n, matricola: e.target.value }))} className={inputCls} />
              <select value={nuovo.area} onChange={e => setNuovo(n => ({ ...n, area: e.target.value }))} className={inputCls}>
                <option value="">Area…</option><option value="ufficio">Ufficio</option><option value="reparto">Reparto</option>
              </select>
              <button disabled={busy === 'add'} className="text-sm font-semibold text-white bg-gray-800 px-4 py-2 rounded-xl hover:bg-gray-700 disabled:opacity-50">+ Aggiungi</button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2">Nome</th><th>Matricola</th><th>Ingresso</th><th>Area</th><th>Base</th><th>Ergonomia</th><th>Origine</th><th>Invito</th><th></th>
                </tr></thead>
                <tbody>
                  {dipendentiMostrati.map(d => {
                    const sb = statoBase(d.id, partecipazioni);
                    const erg = partecipazioni.filter(p => p.dipendente_id === d.id && p.tipo === TIPO_ERGONOMIA && p.stato === 'svolta');
                    const ultimaErg = erg.map(p => p.data_svolgimento).filter(Boolean).sort().pop();
                    const aperto = apertoId === d.id;
                    return (
                      <>
                      <tr key={d.id} className={`border-b border-gray-50 ${!d.attivo ? 'opacity-50' : ''}`}>
                        <td className="py-2 font-medium text-gray-800">
                          <button onClick={() => setApertoId(aperto ? null : d.id)} title="Storico" className="text-gray-400 mr-1">{aperto ? '▾' : '▸'}</button>
                          {d.nome}{d.straordinario && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded">straordinario</span>}{!d.attivo && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 rounded">cessato</span>}</td>
                        <td className="text-gray-500">{d.matricola || '—'}</td>
                        <td className="text-gray-500">{fmt(d.data_ingresso)}</td>
                        <td>
                          <select value={d.area || ''} onChange={e => call('PUT', `/api/org/${clientId}/dipendenti/${d.id}`, { area: e.target.value || null }, d.id)} className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white">
                            <option value="">—</option><option value="ufficio">Ufficio</option><option value="reparto">Reparto</option>
                          </select>
                        </td>
                        <td className={sb.cls}>{sb.label}{sb.data ? ` · ${fmt(sb.data)}` : ''}</td>
                        <td className={erg.length ? 'text-green-700' : 'text-gray-400'}>{erg.length ? `✓ ${fmt(ultimaErg)}` : '—'}</td>
                        <td className="text-gray-400 text-xs">{d.inserito_da}</td>
                        <td className="text-xs">
                          {invitoLinks[d.id] ? (
                            <span className="inline-flex items-center gap-1"><span className="text-green-700 font-semibold">link pronto</span><button onClick={() => navigator.clipboard.writeText(invitoLinks[d.id])} className="text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">Copia</button></span>
                          ) : d.stato_invito_assessment === 'completato' ? (
                            <span className="text-green-700">✓ completato<button onClick={() => genInvito(d)} title="Re-invito (eccezionale)" className="ml-1 text-gray-400 underline">re-invito</button></span>
                          ) : d.stato_invito_assessment === 'invitato' ? (
                            <span className="text-amber-700 inline-flex items-center gap-1">invitato<button onClick={() => genInvito(d)} disabled={busy === 'inv_' + d.id} title="Rigenera (chiude il vecchio link)" className="text-gray-500">↻</button><button onClick={() => revInvito(d)} disabled={busy === 'inv_' + d.id} title="Revoca" className="text-red-500">✕</button></span>
                          ) : d.attivo ? (
                            <button onClick={() => genInvito(d)} disabled={busy === 'inv_' + d.id} className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded disabled:opacity-50">Genera invito</button>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {d.attivo && <>
                            <button onClick={() => call('PUT', `/api/org/${clientId}/dipendenti/${d.id}`, { straordinario: !d.straordinario }, d.id)} title="Straordinario" className="text-xs text-purple-600 px-1">⇅</button>
                            <button onClick={() => { if (confirm(`Segnare cessato ${d.nome}?`)) call('PUT', `/api/org/${clientId}/dipendenti/${d.id}`, { attivo: false, data_cessazione: new Date().toISOString().slice(0, 10) }, d.id); }} title="Cessazione" className="text-xs text-red-500 px-1">✕</button>
                          </>}
                        </td>
                      </tr>
                      {aperto && (
                        <tr key={`${d.id}_st`} className="bg-gray-50/60 border-b border-gray-100">
                          <td colSpan={9} className="px-3 py-3">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Storico di {d.nome}</div>
                            {(() => {
                              const righe = storicoDipendente(d, partecipazioni, sessioni);
                              if (!righe.length) return <p className="text-sm text-gray-400">Nessuna attività registrata.</p>;
                              return (
                                <ul className="space-y-1.5">
                                  {righe.map((r, i) => (
                                    <li key={i} className="text-sm flex flex-wrap items-baseline gap-x-2">
                                      <span className="text-gray-500 w-28 shrink-0">{r.quando ? fmt(r.quando) : 'senza data'}</span>
                                      <span className="text-gray-800 font-medium">{r.cosa}</span>
                                      {r.stato && r.stato !== 'fatto' && <span className={r.stato === 'svolta' ? 'text-green-700 text-xs' : r.stato === 'pianificata' ? 'text-amber-700 text-xs' : 'text-red-600 text-xs'}>{r.stato}</span>}
                                      {r.anno && <span className="text-gray-400 text-xs">anno {r.anno}</span>}
                                      {r.dettaglio && <span className="text-gray-400 text-xs">{r.dettaglio}</span>}
                                      {r.origine && <span className="text-[10px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{r.origine}</span>}
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                            <p className="text-[11px] text-gray-400 mt-2">Solo attività organizzative: formazione ed ergonomia. Il percorso clinico non compare qui e non è collegabile a questa anagrafica.</p>
                          </td>
                        </tr>
                      )}
                      </>
                    );
                  })}
                  {dipendentiMostrati.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-gray-400">{dipendenti.length ? 'Nessun dipendente trovato con questa ricerca.' : 'Nessun dipendente. Usa "Importa nomi dal check-up" o aggiungi sopra.'}</td></tr>}
                </tbody>
              </table>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-gray-500">Import lista (una riga per dipendente: <code>nome; data_ingresso; matricola</code>)</summary>
              <textarea value={importTxt} onChange={e => setImportTxt(e.target.value)} rows={4} placeholder={'Mario Rossi; 2025-09-01; M123\nLuca Bianchi; 2025-09-15'} className={`${inputCls} w-full mt-2 font-mono text-xs`} />
              <button onClick={doImport} disabled={busy === 'import'} className="mt-2 text-xs font-semibold text-white bg-gray-800 px-3 py-1.5 rounded-xl disabled:opacity-50">Importa lista</button>
            </details>
          </div>

          <p className="text-xs text-gray-400">Dati organizzativi di titolarità Essentia Salutis, separati dal piano clinico. L&apos;azienda vede solo aggregati.</p>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => ({ props: { clientId: ctx.params.clientId } }));
