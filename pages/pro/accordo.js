import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import { dataIt, dataOraIt } from '../../lib/date-it.mjs';
import { BYTE_MAX } from '../../lib/copia-cartacea.mjs';
import { statoPerIlBrowser } from '../../lib/accordo.mjs';

// Accordo sul trattamento dei dati (punto c). Due atti, entrambi obbligatori:
// la SPUNTA qui (prova l'atto) e la COPIA FIRMATA (prova il contenuto), sulla
// stessa versione dell'archivio. Nessun testo legale scritto nel codice.

function StatoAccordo({ stato }) {
  if (!stato) return null;
  const box = 'rounded-2xl px-4 py-3 text-sm mb-4 border';
  if (stato.stato === 'valido') {
    return <div className={`${box} bg-green-50 border-green-200 text-green-800`}><strong>✓ Accordo in regola</strong> — versione {stato.versione}: sottoscritto e copia firmata caricata.</div>;
  }
  if (stato.stato === 'in_preavviso') {
    return (
      <div className={`${box} bg-amber-50 border-amber-300 text-amber-900`}>
        <strong>È in vigore una nuova versione dell&apos;accordo ({stato.versione}).</strong> Resti in regola con la versione {stato.versionePrecedente} fino al {dataOraIt(stato.scadenza, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}: entro quella data sottoscrivi la nuova versione e carica la copia firmata, altrimenti non potrai prendere in carico nuovi pazienti né ricevere nuove aziende.
      </div>
    );
  }
  if (stato.stato === 'testo_non_pubblicato') {
    return <div className={`${box} bg-gray-50 border-gray-200 text-gray-700`}><strong>Il testo dell&apos;accordo non è ancora disponibile.</strong> Finché non viene pubblicato non è possibile sottoscriverlo, e senza accordo non si possono ricevere aziende né prendere in carico pazienti.</div>;
  }
  return (
    <div className={`${box} bg-red-50 border-red-200 text-red-800`}>
      <strong>Accordo non in regola</strong> (versione {stato.versione}):{' '}
      {stato.mancaSpunta && stato.mancaFile ? 'manca la sottoscrizione e la copia firmata' : stato.mancaSpunta ? 'manca la sottoscrizione' : 'manca la copia firmata'}. Senza accordo non puoi ricevere aziende né prendere in carico nuovi pazienti.
    </div>
  );
}

export default function AccordoPage({ proName, iniziale }) {
  const [dati, setDati] = useState(iniziale);
  const [letto, setLetto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [versioneFile, setVersioneFile] = useState(iniziale.testo?.id || '');
  const [file, setFile] = useState(null);

  const { testo, stato, versioni } = dati;
  const firmatoVigente = testo && (stato?.firme || []).filter(f => f.testo_legale_id === testo.id).sort((a, b) => Date.parse(a.atto_at) - Date.parse(b.atto_at)).pop();
  const giaSottoscritto = firmatoVigente && firmatoVigente.valore === 'dato';

  async function post(body) {
    const r = await fetch('/api/pro/accordo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Errore');
    return j;
  }

  async function sottoscrivi() {
    setErr(''); setBusy(true);
    try { const j = await post({ azione: 'sottoscrivi', testo_id: testo.id }); setDati(d => ({ ...d, stato: j.stato })); setLetto(false); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }

  async function carica() {
    setErr('');
    if (!file) return;
    if (file.size > BYTE_MAX) { setErr('Il file supera i 10 MB.'); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setErr('Il file non è un PDF, un JPG o un PNG.'); return; }
    setBusy(true);
    try {
      const p = await post({ azione: 'prepara', content_type: file.type });
      const up = await fetch(p.signed_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!up.ok) throw new Error('Il file non è stato caricato: riprova.');
      const j = await post({ azione: 'carica', path: p.path, testo_id: versioneFile });
      setDati(d => ({ ...d, stato: j.stato })); setFile(null);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  async function apri(id) {
    const r = await fetch(`/api/pro/accordo?file=${encodeURIComponent(id)}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) window.open(j.url, '_blank', 'noopener'); else setErr(j.error || 'File non disponibile');
  }

  const c = testo?.contenuto || {};
  return (
    <>
      <Head>
        <title>Accordo sul trattamento dei dati — ES Work</title>
        <style>{`@media print { .no-print { display: none !important; } .piede { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; } body { background: #fff; } }`}</style>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <header className="no-print bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
            <Link href="/pro/documents" className="text-sm text-gray-500 hover:text-gray-800">← Documenti e conformità</Link>
            <span className="text-xs text-gray-500">{proName}</span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-5 py-6">
          <h1 className="text-lg font-bold text-gray-900">Accordo sul trattamento dei dati</h1>
          <p className="no-print text-sm text-gray-500 mt-1 mb-4">Due passaggi, entrambi obbligatori sulla stessa versione: la sottoscrizione qui sotto e la copia firmata caricata.</p>

          <div className="no-print"><StatoAccordo stato={stato} /></div>
          {err && <div role="alert" className="no-print mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

          {testo && (
            <>
              <article className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold text-gray-900">{c.titolo}</div>
                    {(c.sottotitolo || c.riferimento) && <div className="text-xs text-gray-500 mt-0.5">{[c.sottotitolo, c.riferimento].filter(Boolean).join(' · ')}</div>}
                  </div>
                  <button onClick={() => window.print()} className="no-print text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg">Stampa</button>
                </div>
                {(c.sezioni || []).map((s, i) => (
                  <section key={s.id || i} className="mt-4">
                    {s.titolo && <h2 className="text-sm font-semibold text-gray-800">{s.titolo}</h2>}
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mt-1">{s.testo}</p>
                  </section>
                ))}
                {c.dichiarazione_firma && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mt-4">{c.dichiarazione_firma}</p>}
                <div className="text-xs text-gray-400 font-mono mt-5">{`accordo_trattamento_dati · versione ${testo.versione} · impronta ${testo.impronta.slice(0, 12)}`}</div>
              </article>
              <div className="piede hidden print:block">{`accordo_trattamento_dati · versione ${testo.versione} · impronta ${testo.impronta.slice(0, 12)}`}</div>

              <section className="no-print bg-white rounded-2xl border border-gray-200 p-5 mt-4">
                <h2 className="text-sm font-bold text-gray-900">1. Sottoscrizione</h2>
                {giaSottoscritto ? (
                  <p className="text-sm text-green-700 mt-2">✓ Hai sottoscritto la versione {testo.versione} il {dataOraIt(firmatoVigente.atto_at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.</p>
                ) : (
                  <>
                    <label className="flex items-start gap-2 mt-3 text-sm text-gray-800">
                      <input type="checkbox" className="mt-1" checked={letto} onChange={e => setLetto(e.target.checked)} />
                      <span>Ho letto e sottoscrivo l&apos;accordo sul trattamento dei dati, versione {testo.versione}.</span>
                    </label>
                    <button onClick={sottoscrivi} disabled={!letto || busy}
                      className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400">
                      {busy ? 'Registrazione…' : 'Sottoscrivi'}
                    </button>
                  </>
                )}
              </section>
            </>
          )}

          <section className="no-print bg-white rounded-2xl border border-gray-200 p-5 mt-4">
            <h2 className="text-sm font-bold text-gray-900">2. Copia firmata</h2>
            {(versioni || []).length === 0 ? (
              <p className="text-sm text-gray-500 mt-2">Disponibile quando il testo dell&apos;accordo sarà pubblicato.</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mt-1">Stampa l&apos;accordo, firmalo e carica la copia (PDF, JPG o PNG, max 10 MB). La versione è stampata a piè di pagina.</p>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <label className="text-xs font-semibold text-gray-700">Versione firmata
                    <select value={versioneFile} onChange={e => setVersioneFile(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white">
                      {(versioni || []).map(v => <option key={v.id} value={v.id}>{v.versione}{v.stato === 'in_vigore' ? ' (in vigore)' : ' (ritirata)'}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-700">File
                    <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 block text-sm" />
                  </label>
                </div>
                <button onClick={carica} disabled={!file || !versioneFile || busy}
                  className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400">
                  {busy ? 'Verifica in corso…' : 'Carica e verifica la copia'}
                </button>
              </>
            )}
            {(stato?.file || []).length > 0 && (
              <ul className="mt-4 divide-y divide-gray-100 text-sm">
                {stato.file.map(f => (
                  <li key={f.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-gray-700">Versione {f.versione} · caricata il {dataIt(f.caricato_il)}{f.caricato_da === 'amministratore' ? ' · caricata dall’amministratore' : ''}</span>
                    <button onClick={() => apri(f.id)} className="text-xs font-semibold text-indigo-700">Apri</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const proId = ctx.req.proSession.proId;
  const proName = ctx.req.proSession.proName;
  if (ctx.req.proSession.mustReset) return { redirect: { destination: '/pro/reset-password', permanent: false } };
  const { statoAccordoPro, testoAccordoInVigore, versioniAccordo } = await import('../../lib/accordo-server');
  const [testo, s, versioni] = await Promise.all([testoAccordoInVigore(), statoAccordoPro(proId), versioniAccordo()]);
  const stato = statoPerIlBrowser(s);
  return { props: { proName, iniziale: JSON.parse(JSON.stringify({ testo, stato, versioni })) } };
});
