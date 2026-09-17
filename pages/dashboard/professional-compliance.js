import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getProComplianceOverview } from '../../lib/store';
import { SHOW_RC_RECEIPT } from '../../lib/pro-docs';
import { dataIt } from '../../lib/date-it.mjs';

// Colonne documento della vista admin. La "Qualifica" collassa i due sotto-slot
// (titolo di formazione + albo) in un'unica colonna: ✓ se almeno uno è presente,
// ma con due chip che mostrano QUALE è stato fornito (titolo / albo / entrambi).
const COLS = [
  { key: 'identity', label: 'Identità', type: 'identity', required: true },
  { key: 'qualification', label: 'Qualifica', qualification: true, required: true },
  { key: 'rc_policy', label: 'Polizza RC', type: 'rc_policy', required: true },
  ...(SHOW_RC_RECEIPT ? [{ key: 'rc_receipt', label: 'Quietanza', type: 'rc_receipt', required: false }] : []),
  { key: 'contract', label: 'Contratto', type: 'contract', required: true },
];
const RC = {
  expired:   { txt: 'Scaduta',          cls: 'bg-red-100 text-red-700' },
  missing:   { txt: 'Mancante',         cls: 'bg-red-100 text-red-700' },   // niente copertura → sospensione
  expiring:  { txt: 'In scadenza',      cls: 'bg-amber-100 text-amber-700' }, // copertura valida → promemoria
  no_expiry: { txt: 'Scadenza assente', cls: 'bg-amber-100 text-amber-700' },
  valid:     { txt: 'Valida',           cls: 'bg-green-100 text-green-700' },
};
const fmt = d => d ? dataIt(d, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ProCompliancePage({ overview: initial, versioniAccordo = [] }) {
  const [rows, setRows] = useState(initial || []);

  async function download(id) {
    const r = await fetch(`/api/admin/pro-documents/${id}`);
    const j = await r.json();
    if (r.ok && j.url) window.open(j.url, '_blank'); else alert(j.error || 'Errore');
  }
  async function setExpiry(row, docId, expiry_date) {
    const r = await fetch(`/api/admin/pro-documents/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiry_date }) });
    if (!r.ok) { alert('Errore'); return; }
    // ricalcolo stato RC lato client
    const now = Date.now(), in30 = now + 30 * 864e5;
    let rcStatus = 'no_expiry';
    if (expiry_date) { const e = Date.parse(expiry_date); rcStatus = e < now ? 'expired' : e <= in30 ? 'expiring' : 'valid'; }
    setRows(prev => prev.map(x => x.professional.id === row.professional.id
      ? { ...x, rcExpiry: expiry_date || null, rcStatus, rcBlocking: rcStatus === 'expired', docs: { ...x.docs, rc_policy: x.docs.rc_policy ? { ...x.docs.rc_policy, expiry_date: expiry_date || null } : x.docs.rc_policy } }
      : x));
  }

  const suspended = rows.filter(r => r.rcStatus === 'expired' || r.rcStatus === 'missing').length;
  const expiring = rows.filter(r => r.rcStatus === 'expiring').length;

  return (
    <>
      <Head><title>Conformità professionisti — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <div>
              <h1 className="font-bold text-gray-900">🛡️ Conformità professionisti</h1>
              <p className="text-xs text-gray-500">Documenti obbligatori e scadenze polizza RC · {rows.length} professionisti{suspended > 0 ? ` · ${suspended} senza RC valida` : ''}</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6">
          {suspended > 0 && (
            <div className="mb-3 text-sm bg-red-50 border border-red-200 text-red-800 rounded-2xl px-4 py-3">
              ⛔ <strong>{suspended}</strong> professionist{suspended === 1 ? 'a' : 'i'} con polizza RC <strong>scaduta o mancante</strong>: in assenza di copertura valida l&apos;operatività è sospesa (Art. 7.4). <strong>Si raccomanda di non assegnare nuovi pazienti</strong> finché la posizione non è regolarizzata.
            </div>
          )}
          {expiring > 0 && (
            <div className="mb-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3">
              ⏳ <strong>{expiring}</strong> professionist{expiring === 1 ? 'a' : 'i'} con polizza RC <strong>in scadenza</strong> (≤30 giorni). La copertura è ancora valida: promemoria di rinnovo.
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Professionista</th>
                  {COLS.map(c => <th key={c.key} className="px-3 py-3 text-center">{c.label}</th>)}
                  <th className="px-3 py-3 text-center">Accordo dati</th>
                  <th className="px-4 py-3">Stato RC</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const rc = RC[row.rcStatus] || RC.missing;
                  const isSusp = row.rcSuspended; // scaduta o mancante
                  const isExpiring = row.rcStatus === 'expiring';
                  return (
                    <tr key={row.professional.id} className={`border-t border-gray-100 ${isSusp ? 'bg-red-50/50' : isExpiring ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-800">{row.professional.name}</span>
                          {isSusp && <span className="text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-100 px-1.5 py-0.5 rounded">non assegnare</span>}
                        </div>
                        <div className="text-xs text-gray-400">{row.professional.email}{!row.professional.active && ' · disattivato'}</div>
                        {row.assignBlocked && (row.assignReasons || []).length > 0 && (
                          <div className="text-xs text-red-700 mt-1">Non assegnabile: {row.assignReasons.join('; ')}</div>
                        )}
                      </td>
                      {COLS.map(c => c.qualification ? (
                        <td key={c.key} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {row.qualificationOk
                              ? <span className="text-green-600 font-bold" title="Almeno una qualifica presente">✓</span>
                              : <span className="text-red-400" title="Nessuna qualifica caricata">—</span>}
                            <div className="flex items-center gap-1">
                              <QualChip label="Titolo" doc={row.docs.qualification_diploma} onDownload={download} />
                              <QualChip label="Albo" doc={row.docs.albo} onDownload={download} />
                            </div>
                          </div>
                        </td>
                      ) : (
                        <td key={c.key} className="px-3 py-3 text-center">
                          {row.docs[c.type] ? (
                            <button onClick={() => download(row.docs[c.type].id)} title={`${row.docs[c.type].file_name || 'documento'} · ${fmt(row.docs[c.type].uploaded_at)}`}
                              className="text-green-600 hover:text-green-800 font-bold">✓</button>
                          ) : (
                            <span className={c.required ? 'text-red-400' : 'text-gray-300'}>—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center align-top">
                        <CellaAccordo proId={row.professional.id} accordo={row.accordo} versioni={versioniAccordo} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rc.cls}`}>{rc.txt}</span>
                          {row.docs.rc_policy && (
                            <input type="date" defaultValue={row.rcExpiry || ''} onBlur={e => { if (e.target.value !== (row.rcExpiry || '')) setExpiry(row, row.docs.rc_policy.id, e.target.value || null); }}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={COLS.length + 3} className="px-4 py-8 text-center text-gray-400">Nessun professionista.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            ✓ = documento presente (clicca per scaricarlo, accesso registrato). Nella colonna <strong>Qualifica</strong> i chip «Titolo»/«Albo» indicano quale qualifica è stata fornita: ne basta una per la conformità (utile per sapere chi è già iscritto all&apos;albo). La scadenza della polizza RC è modificabile qui dal titolare. I documenti del professionista sono un trattamento distinto (art. 6.1.b) e non si mescolano coi dati clinici dei pazienti.
          </p>
        </main>
      </div>
    </>
  );
}

// Chip di una singola qualifica nella colonna collassata: verde e cliccabile se
// presente (scarica), grigio tenue se assente. Mostra all'admin QUALE è stata data.
function QualChip({ label, doc, onDownload }) {
  if (doc) return (
    <button onClick={() => onDownload(doc.id)} title={`${doc.file_name || 'documento'} · ${fmt(doc.uploaded_at)}`}
      className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded hover:bg-green-200">{label}</button>
  );
  return <span className="text-[10px] text-gray-300 px-1.5 py-0.5" title="Non fornito">{label}</span>;
}

// Accordo sul trattamento dei dati (v66): stato, file caricati (apribili) e
// caricamento della copia firmata da parte dell'admin, con la dicitura. La
// sottoscrizione no: la dà solo il professionista.
const STATO_ACCORDO = {
  valido: { txt: 'In regola', cls: 'bg-green-100 text-green-700' },
  in_preavviso: { txt: 'Preavviso', cls: 'bg-amber-100 text-amber-700' },
  mancante: { txt: 'Non in regola', cls: 'bg-red-100 text-red-700' },
  testo_non_pubblicato: { txt: 'Testo non pubblicato', cls: 'bg-gray-100 text-gray-600' },
};
function CellaAccordo({ proId, accordo, versioni }) {
  const [file, setFile] = useState(null);
  const [versione, setVersione] = useState((versioni.find(v => v.stato === 'in_vigore') || versioni[0] || {}).id || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const st = STATO_ACCORDO[accordo?.stato] || { txt: 'Verifica non disponibile', cls: 'bg-red-100 text-red-700' };
  const firmaVigente = accordo && versioni.find(v => v.stato === 'in_vigore') && (accordo.firme || []).some(f => f.valore === 'dato' && f.testo_legale_id === versioni.find(v => v.stato === 'in_vigore').id);

  async function carica() {
    if (!file || !versione) return;
    setBusy(true); setMsg('');
    try {
      const base = `/api/admin/professionals/${proId}/accordo`;
      const p = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'prepara', content_type: file.type }) });
      const pj = await p.json(); if (!p.ok) throw new Error(pj.error || 'Errore');
      const up = await fetch(pj.signed_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!up.ok) throw new Error('Il file non è stato caricato: riprova.');
      const c = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'carica', path: pj.path, testo_id: versione }) });
      const cj = await c.json(); if (!c.ok) throw new Error(cj.error || 'Errore');
      window.location.reload();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center gap-1 min-w-[150px]">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`} title={accordo?.motivo || ''}>{st.txt}{accordo?.versione ? ` · ${accordo.versione}` : ''}</span>
      {accordo && accordo.stato !== 'testo_non_pubblicato' && (
        <span className="text-[11px] text-gray-500">{firmaVigente ? 'sottoscritto' : 'non sottoscritto'}</span>
      )}
      {(accordo?.file || []).map(f => (
        <a key={f.id} href={`/api/admin/professionals/${proId}/accordo?file=${f.id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-indigo-700 underline">
          copia v. {f.versione} · {fmt(f.caricato_il)}{String(f.caricato_da).startsWith('admin:') ? ' · caricata dall’amministratore' : ''}
        </a>
      ))}
      {versioni.length > 0 && (
        <details className="text-left w-full">
          <summary className="text-[11px] text-gray-500 cursor-pointer text-center">carica copia firmata</summary>
          <div className="mt-1 space-y-1">
            <select value={versione} onChange={e => setVersione(e.target.value)} className="w-full text-xs border border-gray-200 rounded px-1 py-1">
              {versioni.map(v => <option key={v.id} value={v.id}>{v.versione}{v.stato === 'in_vigore' ? ' (in vigore)' : ''}</option>)}
            </select>
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-[11px]" />
            <button onClick={carica} disabled={!file || busy} className="w-full text-xs font-semibold py-1 rounded bg-gray-900 text-white disabled:bg-gray-200 disabled:text-gray-400">{busy ? 'Verifica…' : 'Carica'}</button>
            {msg && <div className="text-[11px] text-red-700">{msg}</div>}
          </div>
        </details>
      )}
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  let overview = [];
  try { overview = await getProComplianceOverview(); } catch (_) {}
  let versioniAccordo = [];
  try { const { versioniAccordo: va } = await import('../../lib/accordo-server'); versioniAccordo = await va(); } catch (_) {}
  return { props: { overview: JSON.parse(JSON.stringify(overview)), versioniAccordo: JSON.parse(JSON.stringify(versioniAccordo)) } };
});
