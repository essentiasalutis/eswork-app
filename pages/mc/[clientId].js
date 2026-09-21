import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireMcAuthSsr } from '../../lib/mc-auth';
import { dataIt } from '../../lib/date-it.mjs';

// Pagina di un'azienda per il medico competente. Tre cose, tutte aggregate:
//   · i dati del check-up (Sintesi sanitaria) e i report di monitoraggio consegnati;
//   · il contributo per la riunione periodica (art. 35 D.Lgs. 81/08);
//   · le indicazioni su reparti o mansioni (mai persone), visibili solo al
//     coordinamento Essentia Salutis.

function Documento({ html, titolo }) {
  if (!html) return null;
  return <iframe title={titolo} sandbox="" srcDoc={html} className="w-full h-[70vh] border border-slate-200 rounded-xl bg-white" />;
}

export default function McAzienda({ clientId, azienda }) {
  const [scheda, setScheda] = useState('dati');
  const [sintesi, setSintesi] = useState(null);
  const [report, setReport] = useState([]);
  const [aperto, setAperto] = useState(null);
  const [riunione, setRiunione] = useState(null);
  const [ind, setInd] = useState({ reparti: [], mie: [], guida: '', testoMax: 160 });
  const [scelta, setScelta] = useState('');
  const [testo, setTesto] = useState('');
  const [msg, setMsg] = useState(null);
  const [lavoro, setLavoro] = useState(false);

  const get = (u) => fetch(u).then(r => r.json());
  useEffect(() => {
    get(`/api/mc/${clientId}/sintesi`).then(setSintesi).catch(() => setSintesi({ html: null, motivo: 'Non disponibile.' }));
    get(`/api/mc/${clientId}/report`).then(j => setReport(j.report || [])).catch(() => {});
    get(`/api/mc/${clientId}/indicazioni`).then(j => j && j.reparti && setInd(j)).catch(() => {});
  }, [clientId]);

  async function apriReport(r) {
    setAperto({ ...r, html: null });
    const j = await get(`/api/mc/${clientId}/report/${r.id}`).catch(() => ({}));
    setAperto({ ...r, html: j.html || null, errore: j.html ? null : 'Report non disponibile.' });
  }

  async function preparaRiunione() {
    setLavoro(true);
    const r = await fetch(`/api/mc/${clientId}/riunione`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setRiunione(r.ok ? j : { errore: j.error || 'Documento non disponibile.' });
    setLavoro(false);
  }

  function stampa() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.opener = null;
    w.document.write(riunione.html); w.document.close(); w.focus(); w.print();
  }

  async function inviaIndicazione(e) {
    e.preventDefault();
    setMsg(null); setLavoro(true);
    const r = await fetch(`/api/mc/${clientId}/indicazioni`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reparto_id: scelta, testo }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setInd(p => ({ ...p, mie: j.mie })); setScelta(''); setTesto(''); setMsg({ ok: true, t: 'Indicazione registrata.' }); }
    else setMsg({ ok: false, t: j.error || 'Indicazione non registrata.' });
    setLavoro(false);
  }

  const tab = (k, t) => <button onClick={() => setScheda(k)} className={`px-3 py-2 text-sm font-semibold rounded-lg ${scheda === k ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t}</button>;

  return (
    <>
      <Head><title>{azienda} — medico competente</title></Head>
      <main className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
            <Link href="/mc" className="text-sm text-slate-500">← Le aziende assegnate</Link>
            <span className="text-sm font-semibold text-slate-900">{azienda}</span>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-5 py-5">
          <p className="text-xs text-slate-500 mb-3">Dati aggregati del programma ES Work per questa azienda: nessun dato individuale, gruppi piccoli non mostrati.</p>
          <nav className="flex gap-1 mb-4">{tab('dati', 'Dati del check-up')}{tab('report', 'Report di monitoraggio')}{tab('riunione', 'Riunione periodica')}{tab('indicazioni', 'Indicazioni')}</nav>

          {scheda === 'dati' && (sintesi == null ? <p className="text-sm text-slate-500">Caricamento…</p>
            : sintesi.html ? <Documento html={sintesi.html} titolo="Dati aggregati del check-up" />
            : <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-4">{sintesi.motivo || 'Non disponibile.'}</p>)}

          {scheda === 'report' && (
            <div className="space-y-3">
              {report.length === 0 ? <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-4">Nessun report di monitoraggio consegnato all&apos;azienda finora.</p> : (
                <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {report.map(r => (
                    <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>{r.etichetta} · {dataIt(r.data)}</span>
                      <button onClick={() => apriReport(r)} className="text-xs font-semibold text-slate-900 underline">Apri</button>
                    </li>
                  ))}
                </ul>
              )}
              {aperto && (aperto.errore ? <p className="text-sm text-red-700">{aperto.errore}</p> : aperto.html ? <Documento html={aperto.html} titolo={aperto.etichetta} /> : <p className="text-sm text-slate-500">Caricamento…</p>)}
            </div>
          )}

          {scheda === 'riunione' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-700">Un documento unico da usare come contributo alla riunione periodica (art. 35 D.Lgs. 81/08): i dati aggregati del check-up e i report di monitoraggio consegnati all&apos;azienda.</p>
              <button onClick={preparaRiunione} disabled={lavoro} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 disabled:opacity-50">{lavoro ? 'Preparazione…' : 'Prepara il documento'}</button>
              {riunione && (riunione.errore ? <p className="mt-3 text-sm text-red-700">{riunione.errore}</p> : (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-3 text-sm">
                    {riunione.url && <a href={riunione.url} target="_blank" rel="noreferrer" className="font-semibold underline">Scarica il PDF</a>}
                    <button onClick={stampa} className="font-semibold underline">Stampa / Salva PDF</button>
                  </div>
                  <Documento html={riunione.html} titolo="Contributo alla riunione periodica" />
                </div>
              ))}
            </div>
          )}

          {scheda === 'indicazioni' && (
            <div className="space-y-4">
              <form onSubmit={inviaIndicazione} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-sm text-slate-700">Indica un reparto o una mansione che ritieni meritevole di attenzione. Le indicazioni le legge solo il coordinamento Essentia Salutis: non arrivano all&apos;azienda né ai lavoratori.</p>
                {ind.reparti.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">L&apos;elenco dei reparti e delle mansioni di questa azienda non è ancora stato preparato dal coordinamento.</p>
                ) : (
                  <>
                    <label className="block mt-3 text-xs font-semibold text-slate-700">Reparto o mansione
                      <select value={scelta} onChange={e => setScelta(e.target.value)} required className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white">
                        <option value="">Scegli dall&apos;elenco…</option>
                        {ind.reparti.map(r => <option key={r.id} value={r.id}>{r.tipo === 'mansione' ? 'Mansione' : 'Reparto'}: {r.nome}</option>)}
                      </select>
                    </label>
                    <label className="block mt-3 text-xs font-semibold text-slate-700">Nota breve (facoltativa, una riga)
                      <input value={testo} onChange={e => setTesto(e.target.value.replace(/[\r\n]/g, ' '))} maxLength={ind.testoMax} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </label>
                    <p className="text-xs text-slate-500 mt-1">{ind.guida} {testo.length}/{ind.testoMax}</p>
                    {msg && <div role="alert" className={`mt-2 text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.t}</div>}
                    <button disabled={lavoro || !scelta} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 disabled:opacity-50">Registra l&apos;indicazione</button>
                  </>
                )}
              </form>
              {ind.mie.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-sm font-semibold text-slate-900 mb-2">Le tue indicazioni per questa azienda</div>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {ind.mie.map(i => <li key={i.id} className="py-2"><span className="text-slate-500">{dataIt(i.creato_il)} · {i.reparto_tipo === 'mansione' ? 'Mansione' : 'Reparto'}: </span>{i.reparto_nome}{i.testo ? ` — ${i.testo}` : ''}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = requireMcAuthSsr(async (ctx) => {
  const clientId = String(ctx.params.clientId || '');
  const { relazioneAttiva, registra } = await import('../../lib/medico-competente-server');
  const ok = await relazioneAttiva(ctx.req.medico.id, clientId).catch(() => false);
  const ip = ctx.req.headers['x-forwarded-for'] || null, userAgent = ctx.req.headers['user-agent'];
  if (!ok) {
    await registra({ medicoId: ctx.req.medico.id, clientId: /^[A-Za-z0-9_-]{1,80}$/.test(clientId) ? clientId : null, azione: 'pagina_azienda', esito: 'rifiutato', ip, userAgent });
    return { notFound: true };
  }
  const { default: supabase } = await import('../../lib/db');
  const { data: c } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
  await registra({ medicoId: ctx.req.medico.id, clientId, azione: 'pagina_azienda', ip, userAgent });
  return { props: { clientId, azienda: c ? c.name : '' } };
});
