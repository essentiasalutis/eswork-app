import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { dataIt, dataOraIt } from '../../lib/date-it.mjs';

// Medici competenti (21/9). Pagina separata dalla scheda azienda: il ruolo è
// opzionale e additivo, un'azienda senza medico non incontra mai niente di questo.

const box = 'bg-white border border-gray-200 rounded-2xl p-5';
const btn = 'text-xs font-semibold px-3 py-1.5 rounded-lg border';

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Operazione non riuscita');
  return j;
}

function Medico({ m, aziende, tipiDocumento, ricarica }) {
  const [clientId, setClientId] = useState('');
  const [tipo, setTipo] = useState('accordo');
  const [dataFirma, setDataFirma] = useState('');
  const [file, setFile] = useState(null);
  const [errore, setErrore] = useState('');
  const [accessi, setAccessi] = useState(null);

  const esegui = async (f) => { setErrore(''); try { await f(); await ricarica(); } catch (e) { setErrore(e.message); } };
  const assegna = () => esegui(() => post('/api/admin/medici-competenti', { azione: 'assegna', medicoId: m.id, clientId }));
  const revoca = (id) => { if (window.confirm('Revocare l\'accesso a questa azienda? La relazione resta nello storico.')) esegui(() => post('/api/admin/medici-competenti', { azione: 'revoca', relazioneId: id })); };
  const carica = () => esegui(async () => {
    if (!file || !dataFirma) throw new Error('Scegli il file e la data della firma.');
    const p = await post('/api/admin/medici-competenti', { azione: 'prepara_documento', medicoId: m.id, content_type: file.type });
    const up = await fetch(p.signed_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!up.ok) throw new Error('Il file non è stato caricato: riprova.');
    await post('/api/admin/medici-competenti', { azione: 'carica_documento', medicoId: m.id, path: p.path, tipo, data_firma: dataFirma });
    setFile(null); setDataFirma('');
  });
  const apri = async (id) => { try { const j = await post('/api/admin/medici-competenti', { azione: 'apri_documento', documentoId: id }); window.open(j.url, '_blank', 'noopener'); } catch (e) { setErrore(e.message); } };
  const leggiAccessi = async () => { const r = await fetch(`/api/admin/medici-competenti/accessi?medicoId=${m.id}`).then(x => x.json()); setAccessi(r.accessi || []); };
  const nomeAzienda = (id) => (aziende.find(a => a.id === id) || {}).nome || id;
  const tipiCaricati = new Set(m.documenti.map(d => d.tipo));

  return (
    <div className={box}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-gray-900">{m.nome}{!m.attivo && <span className="ml-2 text-xs text-red-700">disattivato</span>}</div>
          <div className="text-xs text-gray-500">{m.email} · creato il {dataIt(m.creato_il)}{m.must_reset_password ? ' · deve ancora cambiare la password' : ''}</div>
        </div>
        <button onClick={() => esegui(() => post('/api/admin/medici-competenti', { azione: m.attivo ? 'disattiva' : 'riattiva', medicoId: m.id }))} className={`${btn} border-gray-200 text-gray-700`}>{m.attivo ? 'Disattiva' : 'Riattiva'}</button>
      </div>
      {errore && <div role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errore}</div>}

      <div className="mt-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Documenti sul profilo</div>
        {Object.entries(tipiDocumento).map(([t, etichetta]) => (
          <div key={t} className="text-sm">{tipiCaricati.has(t) ? '✅' : '⛔'} {etichetta}</div>
        ))}
        {m.documenti.length > 0 && (
          <ul className="mt-2 text-xs text-gray-600">
            {m.documenti.map(d => <li key={d.id}>{tipiDocumento[d.tipo]} · firmato il {dataIt(d.data_firma)} · caricato il {dataIt(d.caricato_il)} · <span className="font-mono">{d.file_impronta.slice(0, 12)}</span> · <button onClick={() => apri(d.id)} className="underline">apri</button></li>)}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5">{Object.entries(tipiDocumento).map(([t, e]) => <option key={t} value={t}>{e}</option>)}</select>
          <label>Data della firma <input type="date" value={dataFirma} onChange={e => setDataFirma(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1" /></label>
          <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button onClick={carica} className={`${btn} border-gray-300 text-gray-800`}>Carica</button>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Aziende</div>
        <ul className="text-sm">
          {m.relazioni.map(r => (
            <li key={r.id} className="py-1">
              {r.azienda} · dal {dataIt(r.dal)}
              {r.revocato_il ? <span className="text-gray-500"> · revocata il {dataIt(r.revocato_il)}</span> : <button onClick={() => revoca(r.id)} className="ml-2 text-xs text-red-700 underline">revoca</button>}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2 items-center">
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Assegna a un&apos;azienda…</option>
            {aziende.map(a => <option key={a.id} value={a.id}>{a.nome}{a.demo ? ' (demo)' : ''}</option>)}
          </select>
          <button onClick={assegna} disabled={!clientId} className={`${btn} border-gray-300 text-gray-800 disabled:opacity-40`}>Assegna</button>
        </div>
      </div>

      <div className="mt-4">
        <button onClick={leggiAccessi} className="text-xs underline text-gray-600">Registro degli accessi</button>
        {accessi && (
          <ul className="mt-2 max-h-64 overflow-auto text-xs text-gray-700 font-mono">
            {accessi.length === 0 ? <li>Nessun accesso.</li> : accessi.map(a => <li key={a.id}>{dataOraIt(a.creato_il)} · {a.azione}{a.client_id ? ` · ${nomeAzienda(a.client_id)}` : ''}{a.esito === 'rifiutato' ? ' · RIFIUTATO' : ''}{a.dettaglio ? ` · ${a.dettaglio}` : ''}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function Reparti({ aziende }) {
  const [clientId, setClientId] = useState('');
  const [elenco, setElenco] = useState([]);
  const [indicazioni, setIndicazioni] = useState([]);
  const [tipo, setTipo] = useState('reparto');
  const [nome, setNome] = useState('');
  const [errore, setErrore] = useState('');

  const carica = useCallback(async (id) => {
    if (!id) { setElenco([]); setIndicazioni([]); return; }
    const [r, i] = await Promise.all([
      fetch(`/api/admin/medici-competenti/reparti?clientId=${id}`).then(x => x.json()),
      fetch(`/api/admin/medici-competenti/indicazioni?clientId=${id}`).then(x => x.json()),
    ]);
    setElenco(r.reparti || []); setIndicazioni(i.indicazioni || []);
  }, []);
  useEffect(() => { carica(clientId); }, [clientId, carica]);

  const esegui = async (url, body) => { setErrore(''); try { await post(url, body); await carica(clientId); } catch (e) { setErrore(e.message); } };
  const marca = (id) => { const motivo = window.prompt('Perché questa indicazione non è utilizzabile? (resta visibile, marcata)'); if (motivo) esegui('/api/admin/medici-competenti/indicazioni', { azione: 'non_utilizzabile', id, motivo }); };

  return (
    <div className={box}>
      <div className="font-bold text-gray-900">Reparti, mansioni e indicazioni per azienda</div>
      <p className="text-xs text-gray-500 mt-1">L&apos;elenco lo cura il coordinamento: il medico sceglie da qui. Le indicazioni le vede solo il coordinamento.</p>
      <select value={clientId} onChange={e => setClientId(e.target.value)} className="mt-3 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
        <option value="">Scegli un&apos;azienda…</option>
        {aziende.map(a => <option key={a.id} value={a.id}>{a.nome}{a.demo ? ' (demo)' : ''}</option>)}
      </select>
      {errore && <div role="alert" className="mt-3 text-sm text-red-700">{errore}</div>}
      {clientId && (
        <>
          <ul className="mt-3 text-sm">
            {elenco.length === 0 && <li className="text-gray-500">Nessun reparto o mansione.</li>}
            {elenco.map(r => (
              <li key={r.id} className={r.attivo ? '' : 'text-gray-400'}>
                {r.tipo === 'mansione' ? 'Mansione' : 'Reparto'}: {r.nome}
                {r.attivo ? <button onClick={() => esegui('/api/admin/medici-competenti/reparti', { azione: 'disattiva', id: r.id })} className="ml-2 text-xs underline">disattiva</button> : ` · disattivato il ${dataIt(r.disattivato_il)}`}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2 items-center text-sm">
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5"><option value="reparto">Reparto</option><option value="mansione">Mansione</option></select>
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={80} placeholder="Nome" className="border border-gray-300 rounded-lg px-2 py-1.5" />
            <button onClick={() => { esegui('/api/admin/medici-competenti/reparti', { azione: 'crea', clientId, tipo, nome }); setNome(''); }} className={`${btn} border-gray-300 text-gray-800`}>Aggiungi</button>
          </div>
          <div className="mt-5 text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Indicazioni dei medici</div>
          <ul className="text-sm divide-y divide-gray-100">
            {indicazioni.length === 0 && <li className="text-gray-500 py-1">Nessuna indicazione.</li>}
            {indicazioni.map(i => (
              <li key={i.id} className="py-2">
                <div><span className="text-gray-500">{dataOraIt(i.creato_il)} · {i.medico} · </span>{i.reparto_tipo === 'mansione' ? 'Mansione' : 'Reparto'}: <strong>{i.reparto_nome}</strong>{i.testo ? ` — ${i.testo}` : ''}</div>
                {i.non_utilizzabile_il
                  ? <div className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1 mt-1">Marcata «non utilizzabile» il {dataOraIt(i.non_utilizzabile_il)} — {i.non_utilizzabile_motivo}</div>
                  : <button onClick={() => marca(i.id)} className="text-xs underline text-gray-600">marca «non utilizzabile»</button>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function MediciCompetenti() {
  const [dati, setDati] = useState(null);
  const [nuovo, setNuovo] = useState({ nome: '', email: '', password: '' });
  const [errore, setErrore] = useState('');
  const ricarica = useCallback(async () => setDati(await fetch('/api/admin/medici-competenti').then(r => r.json())), []);
  useEffect(() => { ricarica(); }, [ricarica]);

  async function crea(e) {
    e.preventDefault(); setErrore('');
    try { await post('/api/admin/medici-competenti', { azione: 'crea', ...nuovo }); setNuovo({ nome: '', email: '', password: '' }); await ricarica(); }
    catch (err) { setErrore(err.message); }
  }

  return (
    <>
      <Head><title>Medici competenti — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-5 py-3"><Link href="/dashboard" className="text-sm text-gray-500">← Dashboard</Link></div>
        </header>
        <main className="max-w-4xl mx-auto px-5 py-6 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Medici competenti</h1>
            <p className="text-sm text-gray-500 mt-1">Ruolo opzionale: il medico competente consulta i soli dati aggregati delle aziende assegnate e indica reparti o mansioni. Non riceve mai dati individuali.</p>
          </div>
          {dati && !dati.informativaPronta && (
            <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
              L&apos;informativa del check-up in vigore non ha ancora la sezione sul medico competente: per ora l&apos;assegnazione è possibile solo alle aziende demo.
            </div>
          )}
          {dati && (
            <div className="text-xs text-gray-600">Per un&apos;azienda reale servono anche l&apos;accordo e la dichiarazione dei quattro presidi: {dati.presidi.join('; ')}.</div>
          )}
          <form onSubmit={crea} className={box}>
            <div className="font-bold text-gray-900 mb-2">Nuovo medico competente</div>
            <div className="grid sm:grid-cols-3 gap-2">
              <input value={nuovo.nome} onChange={e => setNuovo(n => ({ ...n, nome: e.target.value }))} placeholder="Nome e cognome" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="email" value={nuovo.email} onChange={e => setNuovo(n => ({ ...n, email: e.target.value }))} placeholder="Email" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="text" value={nuovo.password} onChange={e => setNuovo(n => ({ ...n, password: e.target.value }))} placeholder="Password iniziale (min. 10)" autoComplete="off" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {errore && <div role="alert" className="mt-2 text-sm text-red-700">{errore}</div>}
            <button className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-900">Crea</button>
            <p className="text-xs text-gray-500 mt-2">Il medico cambia la password al primo accesso su /mc/login.</p>
          </form>
          {dati && dati.medici.map(m => <Medico key={m.id} m={m} aziende={dati.aziende} tipiDocumento={dati.tipiDocumento} ricarica={ricarica} />)}
          {dati && <Reparti aziende={dati.aziende} />}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => ({ props: {} }));
