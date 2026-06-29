import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../../lib/auth';

const fmt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const eur = n => `€${Math.round(Number(n) || 0).toLocaleString('it-IT')}`;

// Stato base del dipendente (calcolato client-side dalle partecipazioni).
function statoBase(dipId, parts) {
  const p = parts.filter(x => x.dipendente_id === dipId && (x.tipo === 'base' || x.tipo === 'base_concentrata'));
  const svolta = p.find(x => x.stato === 'svolta');
  if (svolta) return { label: '✓ svolta', cls: 'text-green-700', data: svolta.data_svolgimento };
  if (p.some(x => x.stato === 'pianificata')) return { label: '◷ pianificata', cls: 'text-amber-700' };
  return { label: '— pendente', cls: 'text-red-600' };
}

export default function FormazionePage({ clientId }) {
  const router = useRouter();
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [nuovo, setNuovo] = useState({ nome: '', data_ingresso: '', matricola: '' });
  const [params, setParams] = useState(null);
  const [importTxt, setImportTxt] = useState('');
  const [erogaFor, setErogaFor] = useState(null); // sessione in erogazione
  const [presenti, setPresenti] = useState({});

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

  const { dipendenti, partecipazioni, sessioni, duplicati, coda, proposta, aggregati } = st;
  const nomeById = Object.fromEntries(dipendenti.map(d => [d.id, d.nome]));

  async function addDip(e) {
    e.preventDefault();
    if (!nuovo.nome.trim()) return;
    const r = await call('POST', `/api/org/${clientId}/dipendenti`, nuovo, 'add');
    if (r) setNuovo({ nome: '', data_ingresso: '', matricola: '' });
  }
  async function doImport() {
    const lista = importTxt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [nome, data_ingresso, matricola] = l.split(/[;,\t]/).map(s => s && s.trim());
      return { nome, data_ingresso: data_ingresso || null, matricola: matricola || null };
    }).filter(x => x.nome);
    const r = await call('POST', `/api/org/${clientId}/import`, { lista }, 'import');
    if (r) setImportTxt('');
  }
  async function eroga() {
    const ids = Object.keys(presenti).filter(k => presenti[k]);
    await call('PUT', `/api/org/sessioni/${erogaFor.id}`, { azione: 'eroga', data_erogazione: new Date().toISOString().slice(0, 10), presenti: ids }, 'eroga');
    setErogaFor(null); setPresenti({});
  }

  const box = 'bg-white rounded-2xl border border-gray-200 p-4';
  const inputCls = 'px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <>
      <Head><title>Formazione — {params.name} — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href={`/dashboard/${clientId}`} className="text-gray-400 hover:text-gray-700">←</Link>
            <div>
              <h1 className="font-bold text-gray-900">📚 Formazione · {params.name}</h1>
              <p className="text-xs text-gray-500">{params.employees} dipendenti · Anno {params.anno_programma} · dati organizzativi (solo titolare)</p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

          {/* Parametri programma */}
          <details className={box}>
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">⚙️ Parametri programma</summary>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              {[['Avvio programma', 'data_avvio_programma', 'date'], ['Anno (override)', 'anno_programma', 'number'], ['Popolazione aderente', 'popolazione_aderente', 'number'], ['Soglia trigger (X)', 'soglia_x', 'number'], ['Capienza gruppo', 'capienza_gruppo', 'number'], ['Listino concentrata €', 'listino_concentrata', 'number'], ['Listino base completa €', 'listino_base_completa', 'number']].map(([lbl, k, type]) => (
                <label key={k} className="text-xs text-gray-500">{lbl}
                  <input type={type} value={params[k] ?? ''} onChange={e => setParams(p => ({ ...p, [k]: e.target.value }))} className={`${inputCls} w-full mt-1`} />
                </label>
              ))}
            </div>
            {!params.capienza_gruppo && <p className="text-xs text-amber-600 mt-2">⚠ Capienza gruppo obbligatoria per generare i recuperi.</p>}
            <button onClick={() => call('PUT', `/api/org/${clientId}`, params, 'params')} disabled={busy === 'params'} className="mt-3 text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">Salva parametri</button>
          </details>

          {/* Coda recupero + trigger + proposta */}
          <div className={`${box} ${proposta.active ? 'border-green-300' : ''}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-bold text-gray-900">🆕 Nuovi ingressi in attesa di recupero</h2>
              <span className="text-sm text-gray-500">{coda.length} in coda · soglia {params.soglia_x}</span>
            </div>
            {coda.length === 0 ? <p className="text-sm text-gray-400 mt-2">Nessun nuovo ingresso in attesa.</p> : (
              <>
                <div className="text-xs text-gray-500 mt-2">Primo in coda: <strong>{coda[0].nome}</strong> (ingresso {fmt(coda[0].data_ingresso)}) · scadenza 6 mesi: <strong>{fmt(proposta.scadenzaSeiMesi)}</strong></div>
                {proposta.active ? (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <div className="text-sm font-semibold text-green-800">⏰ Trigger attivo — {proposta.motivo === 'soglia' ? 'soglia raggiunta' : '6 mesi dal primo in coda'}</div>
                    <div className="text-sm text-green-700 mt-1">
                      Proposta: <strong>{proposta.proposta.tipo === 'base_concentrata' ? 'Base concentrata (1h30)' : 'Base completa (due moduli)'}</strong> · {proposta.proposta.nGruppi} gruppo/i · {proposta.proposta.nPartecipanti} partecipanti · stima <strong>{eur(proposta.proposta.importo)}</strong>
                    </div>
                    <button onClick={() => call('POST', `/api/org/${clientId}/genera-recupero`, {}, 'genera')} disabled={busy === 'genera' || !params.capienza_gruppo} className="mt-2 text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">Genera sessione di recupero</button>
                  </div>
                ) : <p className="text-xs text-gray-400 mt-2">Trigger non ancora attivo (sotto soglia e &lt; 6 mesi).</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">{coda.map(d => <span key={d.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{d.nome}</span>)}</div>
              </>
            )}
          </div>

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
                <button onClick={() => call('POST', `/api/org/${clientId}/seed`, {}, 'seed')} disabled={busy === 'seed'} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl disabled:opacity-50">Importa nomi dall'assessment</button>
              </div>
            </div>
            <form onSubmit={addDip} className="flex gap-2 flex-wrap mb-3">
              <input placeholder="Nome e cognome *" value={nuovo.nome} onChange={e => setNuovo(n => ({ ...n, nome: e.target.value }))} className={inputCls} />
              <input type="date" value={nuovo.data_ingresso} onChange={e => setNuovo(n => ({ ...n, data_ingresso: e.target.value }))} className={inputCls} />
              <input placeholder="Matricola (opz.)" value={nuovo.matricola} onChange={e => setNuovo(n => ({ ...n, matricola: e.target.value }))} className={inputCls} />
              <button disabled={busy === 'add'} className="text-sm font-semibold text-white bg-gray-800 px-4 py-2 rounded-xl hover:bg-gray-700 disabled:opacity-50">+ Aggiungi</button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2">Nome</th><th>Matricola</th><th>Ingresso</th><th>Base</th><th>Origine</th><th></th>
                </tr></thead>
                <tbody>
                  {dipendenti.map(d => {
                    const sb = statoBase(d.id, partecipazioni);
                    return (
                      <tr key={d.id} className={`border-b border-gray-50 ${!d.attivo ? 'opacity-50' : ''}`}>
                        <td className="py-2 font-medium text-gray-800">{d.nome}{d.straordinario && <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded">straordinario</span>}{!d.attivo && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 rounded">cessato</span>}</td>
                        <td className="text-gray-500">{d.matricola || '—'}</td>
                        <td className="text-gray-500">{fmt(d.data_ingresso)}</td>
                        <td className={sb.cls}>{sb.label}{sb.data ? ` · ${fmt(sb.data)}` : ''}</td>
                        <td className="text-gray-400 text-xs">{d.inserito_da}</td>
                        <td className="text-right whitespace-nowrap">
                          {d.attivo && <>
                            <button onClick={() => call('PUT', `/api/org/${clientId}/dipendenti/${d.id}`, { straordinario: !d.straordinario }, d.id)} title="Straordinario" className="text-xs text-purple-600 px-1">⇅</button>
                            <button onClick={() => { if (confirm(`Segnare cessato ${d.nome}?`)) call('PUT', `/api/org/${clientId}/dipendenti/${d.id}`, { attivo: false, data_cessazione: new Date().toISOString().slice(0, 10) }, d.id); }} title="Cessazione" className="text-xs text-red-500 px-1">✕</button>
                          </>}
                        </td>
                      </tr>
                    );
                  })}
                  {dipendenti.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-400">Nessun dipendente. Usa "Importa nomi dall'assessment" o aggiungi sopra.</td></tr>}
                </tbody>
              </table>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-gray-500">Import lista (una riga per dipendente: <code>nome; data_ingresso; matricola</code>)</summary>
              <textarea value={importTxt} onChange={e => setImportTxt(e.target.value)} rows={4} placeholder={'Mario Rossi; 2025-09-01; M123\nLuca Bianchi; 2025-09-15'} className={`${inputCls} w-full mt-2 font-mono text-xs`} />
              <button onClick={doImport} disabled={busy === 'import'} className="mt-2 text-xs font-semibold text-white bg-gray-800 px-3 py-1.5 rounded-xl disabled:opacity-50">Importa lista</button>
            </details>
          </div>

          {/* Sessioni */}
          <div className={box}>
            <h2 className="font-bold text-gray-900 mb-3">🗓 Sessioni formative ({sessioni.length})</h2>
            {sessioni.length === 0 ? <p className="text-sm text-gray-400">Nessuna sessione.</p> : sessioni.map(s => (
              <div key={s.id} className="py-2 border-b border-gray-100 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span><strong>{s.tipo === 'base_concentrata' ? 'Base concentrata' : s.tipo === 'base' ? 'Base completa' : 'Aggiornamento'}</strong> · {s.origine.replace(/_/g, ' ')} · Anno {s.anno_programma} · <span className={s.stato === 'erogata' ? 'text-green-700' : s.stato === 'annullata' ? 'text-gray-400' : 'text-amber-700'}>{s.stato}</span>{s.a_consumo && s.importo_dovuto ? ` · ${eur(s.importo_dovuto)}` : ''}</span>
                  {s.stato === 'pianificata' && <button onClick={() => { setErogaFor(s); setPresenti(Object.fromEntries(partecipazioni.filter(p => p.sessione_formativa_id === s.id).map(p => [p.dipendente_id, true]))); }} className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-lg">Marca erogata</button>}
                </div>
                <div className="text-xs text-gray-400">{s.note}</div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">Dati organizzativi (anagrafica, formazione) di titolarità Essentia Salutis, separati dal piano clinico. L'azienda vede solo aggregati. Aggregato corrente (uso interno): {aggregati.pctBaseCompletata}% base completata · {aggregati.nNuoviInAttesa} in attesa.</p>
        </main>

        {/* Modale conferma presenti */}
        {erogaFor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[80vh] overflow-y-auto">
              <h3 className="font-semibold text-gray-800 mb-1">Conferma presenti</h3>
              <p className="text-xs text-gray-500 mb-3">Solo i presenti passano a "svolta"; i non presenti restano in coda.</p>
              <div className="space-y-1.5">
                {partecipazioni.filter(p => p.sessione_formativa_id === erogaFor.id).map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!presenti[p.dipendente_id]} onChange={e => setPresenti(s => ({ ...s, [p.dipendente_id]: e.target.checked }))} />
                    {nomeById[p.dipendente_id] || p.dipendente_id}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setErogaFor(null)} className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2">Annulla</button>
                <button onClick={eroga} disabled={busy === 'eroga'} className="flex-1 text-sm font-semibold text-white bg-green-600 rounded-xl py-2 disabled:opacity-50">Conferma erogata</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => ({ props: { clientId: ctx.params.clientId } }));
