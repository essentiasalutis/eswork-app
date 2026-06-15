import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import { getProDocuments } from '../../lib/store';
import { rcStatusFrom } from '../../lib/compliance';
import { SLOTS, QUALIFICATION_TYPES } from '../../lib/pro-docs';

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX = 10 * 1024 * 1024;
const fmt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function RcBanner({ rc }) {
  if (!rc) return null;
  const date = rc.expiry ? new Date(rc.expiry).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const inDays = rc.days === 0 ? 'scade oggi' : rc.days === 1 ? 'scade tra 1 giorno' : `scade tra ${rc.days} giorni`;

  if (rc.status === 'expired') {
    return (
      <div className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
        <div className="text-sm font-bold text-red-800">⛔ Polizza RC scaduta{date ? ` il ${date}` : ''}</div>
        <p className="text-sm text-red-700 mt-1 leading-relaxed">
          Ai sensi dell&apos;Art. 7.4 del contratto, in assenza di copertura assicurativa valida l&apos;operatività è sospesa: regolarizza la posizione prima di prendere in carico nuovi pazienti.
        </p>
      </div>
    );
  }
  if (rc.status === 'missing') {
    return (
      <div className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
        <div className="text-sm font-bold text-red-800">⛔ Polizza RC professionale non presente</div>
        <p className="text-sm text-red-700 mt-1 leading-relaxed">
          Ai sensi dell&apos;Art. 7.4 del contratto, in assenza di copertura assicurativa valida l&apos;operatività è sospesa: carica la polizza RC prima di prendere in carico nuovi pazienti.
        </p>
      </div>
    );
  }
  if (rc.status === 'expiring') {
    return (
      <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="text-sm font-semibold text-amber-800">⏳ La tua polizza RC {inDays}{date ? ` (${date})` : ''}</div>
        <p className="text-sm text-amber-700 mt-1 leading-relaxed">
          La copertura è ancora valida: provvedi al rinnovo per non interrompere l&apos;operatività.
        </p>
      </div>
    );
  }
  if (rc.status === 'no_expiry') {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
        ℹ️ Imposta qui sotto la <strong>data di scadenza</strong> della tua polizza RC, così se ne può monitorare la validità.
      </div>
    );
  }
  if (rc.status === 'valid') {
    return (
      <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
        ✅ Polizza RC valida{date ? ` fino al ${date}` : ''}.
      </div>
    );
  }
  return null;
}

export default function ProDocumentsPage({ proName, documents: initial, rc }) {
  const [docs, setDocs] = useState(initial || []);
  const [busy, setBusy] = useState(null);   // doc_type in corso
  const [err, setErr] = useState('');
  const byType = Object.fromEntries(docs.map(d => [d.doc_type, d]));
  const qualificationOk = QUALIFICATION_TYPES.some(t => byType[t]);

  // Raggruppa gli slot consecutivi dello stesso gruppo (es. "qualification":
  // titolo di formazione + albo, di cui ne basta almeno uno per la conformità).
  const blocks = [];
  for (const slot of SLOTS) {
    const last = blocks[blocks.length - 1];
    if (slot.group && last && last.group === slot.group) { last.slots.push(slot); continue; }
    blocks.push({ group: slot.group || null, slots: [slot] });
  }

  async function uploadFor(doc_type, file, expiry) {
    setErr('');
    if (!file) return;
    if (file.size > MAX) { setErr('File troppo grande (max 10 MB).'); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setErr('Sono ammessi solo PDF, JPG o PNG.'); return; }
    setBusy(doc_type);
    try {
      const s = await fetch('/api/pro/documents/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc_type, file_name: file.name, content_type: file.type }) });
      const sj = await s.json(); if (!s.ok) throw new Error(sj.error || 'Errore');
      const up = await fetch(sj.signed_url, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
      if (!up.ok) throw new Error('Caricamento sullo storage fallito');
      const c = await fetch('/api/pro/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc_type, path: sj.path, file_name: file.name, mime_type: file.type, size_bytes: file.size, expiry_date: expiry || null }) });
      const cj = await c.json(); if (!c.ok) throw new Error(cj.error || 'Errore');
      setDocs(prev => [...prev.filter(d => d.doc_type !== doc_type), cj]);
    } catch (e) { setErr(e.message); }
    setBusy(null);
  }

  async function download(id) {
    try {
      const r = await fetch(`/api/pro/documents/${id}`);
      const j = await r.json();
      if (r.ok && j.url) window.open(j.url, '_blank');
      else setErr(j.error || 'Errore');
    } catch { setErr('Errore di rete'); }
  }

  async function remove(doc) {
    if (!window.confirm(`Eliminare "${SLOTS.find(s => s.type === doc.doc_type)?.label}"?`)) return;
    setBusy(doc.doc_type);
    try {
      const r = await fetch(`/api/pro/documents/${doc.id}`, { method: 'DELETE' });
      if (r.ok) setDocs(prev => prev.filter(d => d.id !== doc.id));
      else setErr('Errore eliminazione');
    } catch { setErr('Errore di rete'); }
    setBusy(null);
  }

  async function saveExpiry(doc, expiry_date) {
    try {
      const r = await fetch(`/api/pro/documents/${doc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiry_date }) });
      const j = await r.json();
      if (r.ok) setDocs(prev => prev.map(d => d.id === doc.id ? j : d));
    } catch {}
  }

  return (
    <>
      <Head><title>Documenti e conformità — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
            <Link href="/pro/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Area osteopata</Link>
            <span className="text-xs text-gray-500">{proName}</span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-5 py-6">
          <h1 className="text-lg font-bold text-gray-900">📁 Documenti e conformità</h1>
          <p className="text-sm text-gray-500 mt-1 mb-4">Carica e tieni aggiornati i documenti previsti dal contratto di collaborazione. Sono riservati: visibili solo a te e al titolare.</p>

          <RcBanner rc={rc} />

          {err && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

          <div className="space-y-3">
            {blocks.map((b, i) => b.group === 'qualification' ? (
              <div key={`g-${i}`} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${qualificationOk ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm font-semibold text-gray-800">Qualifica professionale</span>
                  </div>
                  {qualificationOk
                    ? <span className="text-xs font-semibold text-green-700">✓ requisito soddisfatto</span>
                    : <span className="text-xs text-amber-600">· obbligatorio: carica almeno uno</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1 mb-3">
                  Titolo di formazione in osteopatia <strong>oppure</strong> iscrizione all&apos;albo professionale: per la conformità ne basta uno.
                </p>
                <div className="space-y-2">
                  {b.slots.map(slot => (
                    <DocRow key={slot.type} slot={slot} doc={byType[slot.type]} busy={busy === slot.type} nested
                      onUpload={uploadFor} onDownload={download} onRemove={remove} onSaveExpiry={saveExpiry} />
                  ))}
                </div>
              </div>
            ) : (
              <DocRow key={b.slots[0].type} slot={b.slots[0]} doc={byType[b.slots[0].type]} busy={busy === b.slots[0].type}
                onUpload={uploadFor} onDownload={download} onRemove={remove} onSaveExpiry={saveExpiry} />
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-6">
            🔒 I file sono conservati in archivio cifrato e privato. Ogni caricamento e accesso è registrato in un registro dedicato. Formati: PDF, JPG, PNG (max 10 MB).
          </p>
        </main>
      </div>
    </>
  );
}

function DocRow({ slot, doc, busy, onUpload, onDownload, onRemove, onSaveExpiry, nested }) {
  const inputRef = useRef(null);
  const [expiry, setExpiry] = useState(doc?.expiry_date || '');
  const present = !!doc;

  return (
    <div className={nested ? 'rounded-xl border border-gray-200 bg-gray-50/60 p-3' : 'bg-white rounded-2xl border border-gray-200 p-4'}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${present ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm font-semibold text-gray-800">{slot.label}</span>
            {slot.required && !present && <span className="text-xs text-amber-600">· obbligatorio</span>}
          </div>
          {present ? (
            <div className="text-xs text-gray-500 mt-1">
              {doc.file_name || 'documento'} · caricato il {fmt(doc.uploaded_at)}
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-1">Nessun documento caricato</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {present && (
            <button onClick={() => onDownload(doc.id)} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100">Scarica</button>
          )}
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; onUpload(slot.type, f, slot.expiry ? expiry : null); }} />
          <button disabled={busy} onClick={() => inputRef.current?.click()}
            className="text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 disabled:opacity-50">
            {busy ? '…' : present ? 'Sostituisci' : 'Carica'}
          </button>
          {present && (
            <button disabled={busy} onClick={() => onRemove(doc)} className="text-xs text-gray-400 hover:text-red-600 px-1" title="Elimina">🗑</button>
          )}
        </div>
      </div>

      {slot.expiry && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Scadenza polizza:</span>
          <input type="date" value={expiry || ''} onChange={e => setExpiry(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1" />
          {present && (
            <button onClick={() => onSaveExpiry(doc, expiry || null)} className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg hover:bg-indigo-100">Salva scadenza</button>
          )}
          {!present && <span className="text-xs text-gray-400">(la imposti al caricamento)</span>}
        </div>
      )}
    </div>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const proId = ctx.req.proSession.proId;
  const proName = ctx.req.proSession.proName;
  if (ctx.req.proSession.mustReset) {
    return { redirect: { destination: '/pro/reset-password', permanent: false } };
  }
  let documents = [];
  try { documents = await getProDocuments(proId); } catch (_) {}
  const rcDoc = documents.find(d => d.doc_type === 'rc_policy') || null;
  const { status, days } = rcStatusFrom(rcDoc);
  const rc = { status, days, expiry: rcDoc?.expiry_date || null };
  return { props: { proName, documents: JSON.parse(JSON.stringify(documents)), rc } };
});
