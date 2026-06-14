import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import { getProDocuments } from '../../lib/store';

const SLOTS = [
  { type: 'identity', label: "Documento d'identità", required: true },
  { type: 'albo', label: 'Iscrizione albo / elenco', required: true },
  { type: 'rc_policy', label: 'Polizza RC professionale', required: true, expiry: true },
  { type: 'rc_receipt', label: 'Quietanza RC', required: false },
  { type: 'contract', label: 'Contratto di collaborazione firmato', required: true },
];
const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX = 10 * 1024 * 1024;
const fmt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ProDocumentsPage({ proName, documents: initial }) {
  const [docs, setDocs] = useState(initial || []);
  const [busy, setBusy] = useState(null);   // doc_type in corso
  const [err, setErr] = useState('');
  const byType = Object.fromEntries(docs.map(d => [d.doc_type, d]));

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
          {err && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

          <div className="space-y-3">
            {SLOTS.map(slot => (
              <DocRow key={slot.type} slot={slot} doc={byType[slot.type]} busy={busy === slot.type}
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

function DocRow({ slot, doc, busy, onUpload, onDownload, onRemove, onSaveExpiry }) {
  const inputRef = useRef(null);
  const [expiry, setExpiry] = useState(doc?.expiry_date || '');
  const present = !!doc;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
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
  return { props: { proName, documents: JSON.parse(JSON.stringify(documents)) } };
});
