import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import NavMenu from '../../components/NavMenu';
import QrCheckup from '../../components/QrCheckup';
import { requireAuthSsr } from '../../lib/auth';
import { dataOraIt } from '../../lib/date-it.mjs';

// Azienda demo permanente per i convegni (v78, Enrico 21/9): la sala compila il
// check-up dal QR, si genera dal vivo il report di Attivazione, poi si azzera.

const box = 'bg-white rounded-2xl border border-gray-200 p-5';

export default function DemoPermanente({ baseUrl }) {
  const [d, setD] = useState(null);
  const [errore, setErrore] = useState(null);
  const [evento, setEvento] = useState(null);           // { nome, dipendenti, settore }
  const [msg, setMsg] = useState(null);
  const [report, setReport] = useState(null);           // null | 'genera' | { pdf_url, errore }
  const [conferma, setConferma] = useState('');
  const [azzeramento, setAzzeramento] = useState(null); // null | 'in corso' | { esito } | { errore }

  const carica = useCallback(async () => {
    const r = await fetch('/api/admin/demo-permanente').catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setErrore(j.error || 'Demo non disponibile.'); return; }
    setErrore(null); setD(j);
    setEvento(e => e || { nome: j.client.name, dipendenti: String(j.client.employees || ''), settore: j.settore });
  }, []);
  useEffect(() => { carica(); const t = setInterval(carica, 5000); return () => clearInterval(t); }, [carica]);

  async function invia(corpo) {
    const r = await fetch('/api/admin/demo-permanente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    return r && r.ok ? { ok: true, ...j } : { ok: false, errore: j.error || 'Operazione non riuscita: riprova.' };
  }
  async function salvaEvento(e) {
    e.preventDefault();
    const r = await invia({ azione: 'aggiorna', nome: evento.nome, dipendenti: evento.dipendenti, settore: evento.settore });
    setMsg(r.ok ? { ok: true, t: 'Evento salvato.' } : { ok: false, t: r.errore });
    carica();
  }
  async function prezzo(mostra) { await invia({ azione: 'prezzo', mostra }); carica(); }
  async function generaReport() {
    setReport('genera');
    const r = await fetch(`/api/clients/${d.client.id}/generate-activation-report`, { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setReport(r && r.ok ? { pdf_url: j.pdf_url || null } : { errore: j.error || 'Report non generato: riprova.' });
    carica();
  }
  async function azzera() {
    setAzzeramento('in corso');
    const r = await invia({ azione: 'azzera', conferma });
    setAzzeramento(r.ok ? { esito: r.esito, pdfNonCancellati: r.pdfNonCancellati } : { errore: r.errore });
    if (r.ok) { setConferma(''); setReport(null); }
    carica();
  }

  if (errore) return <Pagina><div className={`${box} text-sm text-red-700`}>{errore}</div></Pagina>;
  if (!d || !evento) return <Pagina><p className="text-sm text-gray-400">Caricamento…</p></Pagina>;

  const url = `${baseUrl}/q/c/${d.client.share_code}`;
  const ultimo = d.report && d.report[0];
  const chiusoDalReport = !!ultimo && d.checkup && new Date(ultimo.created_at) > new Date(d.checkup.created_at);

  return (
    <Pagina>
      <div className={box}>
        <h2 className="font-semibold text-gray-800 mb-3">Evento</h2>
        <form onSubmit={salvaEvento} className="grid md:grid-cols-3 gap-3 items-end">
          <label className="text-xs text-gray-500">Nome dell&apos;azienda mostrato in sala
            <input value={evento.nome} onChange={e => setEvento({ ...evento, nome: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          </label>
          <label className="text-xs text-gray-500">Popolazione (dipendenti)
            <input type="number" min="1" value={evento.dipendenti} onChange={e => setEvento({ ...evento, dipendenti: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
          </label>
          <label className="text-xs text-gray-500">Settore
            <select value={evento.settore} onChange={e => setEvento({ ...evento, settore: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white">
              <option value="services">Servizi / uffici</option>
              <option value="manufacturing">Manifattura / produzione</option>
            </select>
          </label>
          <button className="md:col-span-3 justify-self-start px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold">Salva l&apos;evento</button>
        </form>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.t}</p>}
      </div>

      <div className={box}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-[16rem]">
            <h2 className="font-semibold text-gray-800 mb-1">Check-up in sala</h2>
            <p className="text-5xl font-extrabold text-green-700 tabular-nums">{d.risposte}</p>
            <p className="text-sm text-gray-500">risposte ricevute · si aggiorna da sola</p>
            <p className={`mt-3 text-sm font-semibold ${chiusoDalReport ? 'text-amber-700' : 'text-green-700'}`}>
              {chiusoDalReport ? 'Chiuso: il report di Attivazione è stato generato. Per riaprirlo azzera la demo.' : 'Aperto: la sala può compilare.'}
            </p>
            <p className="mt-3 text-xs text-gray-500 font-mono break-all">{url}</p>
            <p className="mt-2 text-xs text-gray-500">Modalità dimostrativa: niente contatti, niente impronta dell&apos;indirizzo; fino a 300 compilazioni in 10 minuti dalla stessa rete.</p>
          </div>
          <QrCheckup url={url} nomeFile={`qr-demo-${d.client.name}`} grande conAnteprima />
        </div>
      </div>

      <div className={box}>
        <h2 className="font-semibold text-gray-800 mb-3">Report di Attivazione</h2>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-3">
          <input type="checkbox" checked={d.client.mostraPrezzo} onChange={e => prezzo(e.target.checked)} className="w-4 h-4 accent-green-600" />
          Mostra la parte economica (investimento Anno 1 e Anno 2)
        </label>
        <button onClick={generaReport} disabled={report === 'genera' || d.risposte === 0}
          className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-40">
          {report === 'genera' ? 'Generazione in corso (20–45 secondi)…' : 'Genera il report di Attivazione'}
        </button>
        <p className="mt-2 text-xs text-gray-500">Dopo il report il check-up si chiude: chi non ha finito non può più inviare.</p>
        {report && report.errore && <p className="mt-2 text-sm text-red-700">{report.errore}</p>}
        {ultimo && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="text-gray-600">Ultimo report: {dataOraIt(ultimo.created_at)}</span>
            {ultimo.pdf_url && <a href={ultimo.pdf_url} target="_blank" rel="noreferrer" className="font-semibold text-green-700 underline">Apri il PDF</a>}
            <Link href={`/dashboard/${d.client.id}`} className="font-semibold text-gray-700 underline">Apri nella scheda azienda</Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-red-200 p-5">
        <h2 className="font-semibold text-red-800 mb-1">Azzera per nuova demo</h2>
        <p className="text-sm text-gray-600 mb-3">Cancella check-up, persone, consensi, report e registro di questa demo e riapre un check-up vuoto. Il nome, la popolazione e il QR restano. Non tocca nessun&apos;altra azienda: la banca dati lo rifiuta.</p>
        <label className="block text-xs text-gray-500 max-w-sm">Per confermare scrivi il nome dell&apos;azienda: «{d.client.name}»
          <input value={conferma} onChange={e => setConferma(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
        </label>
        <button onClick={azzera} disabled={conferma.trim() !== d.client.name || azzeramento === 'in corso'}
          className="mt-3 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40">
          {azzeramento === 'in corso' ? 'Azzeramento…' : 'Azzera per nuova demo'}
        </button>
        {azzeramento && azzeramento.esito && (
          <p className="mt-2 text-sm text-green-700">Azzerata: {azzeramento.esito.persone} persone, {azzeramento.esito.risposte} risposte, {azzeramento.esito.consensi} consensi, {azzeramento.esito.report} report cancellati. Check-up nuovo aperto.{azzeramento.pdfNonCancellati ? ` ${azzeramento.pdfNonCancellati} PDF non cancellati dall'archivio.` : ''}</p>
        )}
        {azzeramento && azzeramento.errore && <p className="mt-2 text-sm text-red-700">{azzeramento.errore}</p>}
      </div>
    </Pagina>
  );
}

function Pagina({ children }) {
  return (
    <>
      <Head><title>Demo convegni — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <h1 className="flex-1 font-bold text-gray-900">🎤 Demo per i convegni</h1>
            <NavMenu />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">{children}</main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { indirizzoDallaRichiesta } = await import('../../lib/indirizzo-sito');
  return { props: { baseUrl: indirizzoDallaRichiesta(ctx.req.headers || {}) } };
});
