import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../../lib/auth';
import { TIPO_ERGONOMIA } from '../../../lib/org-regole.mjs';

const fmt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const eur = n => `€${Math.round(Number(n) || 0).toLocaleString('it-IT')}`;

export default function FormazionePage({ clientId }) {
  const router = useRouter();
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [params, setParams] = useState(null);
  const [erogaFor, setErogaFor] = useState(null); // sessione in erogazione
  const [presenti, setPresenti] = useState({});
  const [conErgonomia, setConErgonomia] = useState(true); // proposta spuntata: vedi modale presenti
  const [ergoFor, setErgoFor] = useState(null);           // { data, note, scelti:{} } intervento di ergonomia

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

  const { dipendenti, partecipazioni, sessioni, coda, proposta, aggregati, ergonomiaCoda } = st;
  const sessioniFormative = sessioni.filter(s => s.tipo !== TIPO_ERGONOMIA);
  const interventiErgonomia = sessioni.filter(s => s.tipo === TIPO_ERGONOMIA);
  const nomeById = Object.fromEntries(dipendenti.map(d => [d.id, d.nome]));

  async function eroga() {
    const ids = Object.keys(presenti).filter(k => presenti[k]);
    const j = await call('PUT', `/api/org/sessioni/${erogaFor.id}`, { azione: 'eroga', data_erogazione: new Date().toISOString().slice(0, 10), presenti: ids, ergonomia: conErgonomia }, 'eroga');
    if (j && j.ergonomiaNonRegistrata) setErr('Sessione registrata, ma l\'ergonomia no: manca la migration v59.');
    setErogaFor(null); setPresenti({}); setConErgonomia(true);
  }
  async function salvaErgonomia() {
    const ids = Object.keys(ergoFor.scelti || {}).filter(k => ergoFor.scelti[k]);
    if (!ids.length) { setErr('Seleziona almeno un dipendente'); return; }
    const j = await call('POST', `/api/org/${clientId}/ergonomia`, { data: ergoFor.data, note: ergoFor.note, dipendenti: ids }, 'ergo');
    if (j) setErgoFor(null);
  }

  const box = 'bg-white rounded-2xl border border-gray-200 p-4';
  const inputCls = 'px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <>
      <Head><title>Formazione — {params.name} — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href={`/dashboard/${clientId}`} className="text-gray-400 hover:text-gray-700">←</Link>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900">📚 Formazione · {params.name}</h1>
              <p className="text-xs text-gray-500">{params.employees} dipendenti · Anno {params.anno_programma} · dati organizzativi (solo titolare)</p>
            </div>
            <Link href={`/dashboard/dipendenti/${clientId}`} className="text-sm text-blue-700 border border-blue-200 bg-blue-50 px-3 py-2 rounded-xl whitespace-nowrap">👥 Dipendenti</Link>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-5 py-6 space-y-5">
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
                    {ergonomiaCoda && (
                      <div className="text-sm text-green-700 mt-1">
                        + Ergonomia nella stessa visita: {ergonomiaCoda.nUfficio + ergonomiaCoda.nNonIndicata} ufficio · {ergonomiaCoda.nReparto} reparto · {ergonomiaCoda.minuti}′ · <strong>{eur(ergonomiaCoda.importo)}</strong> <span className="text-xs text-green-600">(a consumo)</span>
                        {ergonomiaCoda.nNonIndicata > 0 && <div className="text-xs text-amber-700 mt-0.5">{ergonomiaCoda.nNonIndicata} senza area indicata: contati come ufficio. Correggi nell'anagrafica qui sotto.</div>}
                      </div>
                    )}
                    <button onClick={() => call('POST', `/api/org/${clientId}/genera-recupero`, {}, 'genera')} disabled={busy === 'genera' || !params.capienza_gruppo} className="mt-2 text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">Genera sessione di recupero</button>
                  </div>
                ) : <p className="text-xs text-gray-400 mt-2">Trigger non ancora attivo (sotto soglia e &lt; 6 mesi).</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">{coda.map(d => <span key={d.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{d.nome}</span>)}</div>
              </>
            )}
          </div>

          {/* L'anagrafica ora vive in «👥 Dipendenti»: qui resta il richiamo, così i
              nomi si toccano in un posto solo (Enrico, 13/9). */}
          <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 flex items-center justify-between gap-3 flex-wrap">
            <span>👥 <strong>{dipendenti.length}</strong> {dipendenti.length === 1 ? 'dipendente in anagrafica' : 'dipendenti in anagrafica'} · nomi, aree, inviti e accesso HR si gestiscono nella pagina Dipendenti.</span>
            <Link href={`/dashboard/dipendenti/${clientId}`} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">Apri Dipendenti →</Link>
          </div>

          {/* Interventi di ergonomia */}
          <div className={box}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="font-bold text-gray-900">🪑 Interventi di ergonomia ({interventiErgonomia.length})</h2>
              <button onClick={() => setErgoFor({ data: new Date().toISOString().slice(0, 10), note: '', scelti: {} })}
                className="text-xs font-semibold text-white bg-gray-800 px-3 py-1.5 rounded-xl hover:bg-gray-700">+ Registra intervento</button>
            </div>
            <p className="text-xs text-gray-400 mb-2">Chi ha ricevuto l&apos;ergonomia e quando. L&apos;ergonomia dei nuovi ingressi si registra da sola confermando i presenti della sessione di recupero.</p>
            {interventiErgonomia.length === 0 ? <p className="text-sm text-gray-400">Nessun intervento registrato.</p> : interventiErgonomia.map(s => {
              const quanti = partecipazioni.filter(p => p.sessione_formativa_id === s.id).length;
              return (
                <div key={s.id} className="py-2 border-b border-gray-100 text-sm">
                  <span className="font-medium text-gray-800">{fmt(s.data_erogazione || s.data_pianificata)}</span>
                  <span className="text-gray-500"> · {quanti} {quanti === 1 ? 'persona' : 'persone'}</span>
                  {s.note && <span className="text-gray-400 text-xs"> · {s.note}</span>}
                </div>
              );
            })}
          </div>

          {/* Sessioni */}
          <div className={box}>
            <h2 className="font-bold text-gray-900 mb-3">🗓 Sessioni formative ({sessioniFormative.length})</h2>
            {sessioniFormative.length === 0 ? <p className="text-sm text-gray-400">Nessuna sessione.</p> : sessioniFormative.map(s => (
              <div key={s.id} className="py-2 border-b border-gray-100 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span><strong>{s.tipo === 'base_concentrata' ? 'Base concentrata' : s.tipo === 'base' ? 'Base completa' : 'Aggiornamento'}</strong> · {s.origine.replace(/_/g, ' ')} · Anno {s.anno_programma} · <span className={s.stato === 'erogata' ? 'text-green-700' : s.stato === 'annullata' ? 'text-gray-400' : 'text-amber-700'}>{s.stato}</span>{s.a_consumo && s.importo_dovuto ? ` · ${eur(s.importo_dovuto)}` : ''}{s.importo_ergonomia ? ` · ergonomia ${eur(s.importo_ergonomia)}` : ''}</span>
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
              <label className="flex items-start gap-2 text-xs text-gray-600 mt-3 bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                <input type="checkbox" checked={conErgonomia} onChange={e => setConErgonomia(e.target.checked)} className="mt-0.5" />
                <span>Registra anche l&apos;intervento ergonomico per i presenti — nella stessa visita ricevono i loro minuti di ergonomia. Nello storico resterà segnato che arriva da qui.</span>
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setErogaFor(null); setConErgonomia(true); }} className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2">Annulla</button>
                <button onClick={eroga} disabled={busy === 'eroga'} className="flex-1 text-sm font-semibold text-white bg-green-600 rounded-xl py-2 disabled:opacity-50">Conferma erogata</button>
              </div>
            </div>
          </div>
        )}
        {/* Modale intervento di ergonomia */}
        {ergoFor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[85vh] overflow-y-auto">
              <h3 className="font-semibold text-gray-800 mb-1">Registra intervento di ergonomia</h3>
              <p className="text-xs text-gray-500 mb-3">Chi era presente e quando. Nessuna osservazione sulla persona: quelle sono cliniche e non stanno qui.</p>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Data
                <input type="date" value={ergoFor.data} onChange={e => setErgoFor(f => ({ ...f, data: e.target.value }))} className={`${inputCls} w-full mt-1 font-normal`} />
              </label>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Nota (facoltativa, riferita all&apos;intervento)
                <input value={ergoFor.note} onChange={e => setErgoFor(f => ({ ...f, note: e.target.value }))} placeholder="es. campagna annuale reparto A" className={`${inputCls} w-full mt-1 font-normal`} />
              </label>
              <div className="text-xs font-semibold text-gray-500 mb-1">Presenti</div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-2">
                {dipendenti.filter(d => d.attivo).map(d => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!(ergoFor.scelti || {})[d.id]} onChange={e => setErgoFor(f => ({ ...f, scelti: { ...f.scelti, [d.id]: e.target.checked } }))} />
                    {d.nome}{d.area ? <span className="text-xs text-gray-400">· {d.area}</span> : null}
                  </label>
                ))}
                {dipendenti.filter(d => d.attivo).length === 0 && <p className="text-xs text-gray-400">Nessun dipendente attivo.</p>}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setErgoFor(null)} className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2">Annulla</button>
                <button onClick={salvaErgonomia} disabled={busy === 'ergo'} className="flex-1 text-sm font-semibold text-white bg-gray-800 rounded-xl py-2 disabled:opacity-50">Registra</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => ({ props: { clientId: ctx.params.clientId } }));
