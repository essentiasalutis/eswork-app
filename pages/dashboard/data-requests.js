import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getDataRequests } from '../../lib/store';

const TYPE_LABEL = {
  access: 'Accesso / copia dati',
  rectification: 'Rettifica',
  erasure: 'Cancellazione',
  consent_withdrawal: 'Revoca consenso',
};
const TYPE_COLOR = {
  access: '#0891b2', rectification: '#ca8a04', erasure: '#dc2626', consent_withdrawal: '#7c3aed',
};
const STATUS_LABEL = { pending: 'In attesa', processing: 'In lavorazione', done: 'Evasa', rejected: 'Respinta' };
const STATUS_COLOR = { pending: '#b45309', processing: '#1d4ed8', done: '#16a34a', rejected: '#6b7280' };

export default function DataRequestsPage({ requests: initial }) {
  const [requests, setRequests] = useState(initial || []);
  const [savingId, setSavingId] = useState(null);

  async function update(id, status) {
    setSavingId(id);
    let response_note;
    if (status === 'done' || status === 'rejected') {
      response_note = window.prompt(status === 'done' ? 'Nota di evasione (facoltativa):' : 'Motivo del rifiuto (facoltativo):') || undefined;
    }
    try {
      const res = await fetch(`/api/admin/data-requests/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, response_note }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
      } else { alert('Errore aggiornamento'); }
    } catch { alert('Errore di rete'); }
    setSavingId(null);
  }

  const pending = requests.filter(r => r.status === 'pending' || r.status === 'processing');

  return (
    <>
      <Head><title>Richieste GDPR — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <div>
              <h1 className="font-bold text-gray-900">🔐 Richieste diritti GDPR</h1>
              <p className="text-xs text-gray-500">Richieste degli interessati da gestire · {pending.length} aperte · {requests.length} totali</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6">
          {requests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">Nessuna richiesta.</div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => {
                const name = r.patients ? `${r.patients.first_name || ''} ${r.patients.last_name || ''}`.trim() : '(paziente rimosso)';
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: TYPE_COLOR[r.type] + '18', color: TYPE_COLOR[r.type] }}>{TYPE_LABEL[r.type] || r.type}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS_COLOR[r.status] + '18', color: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status] || r.status}</span>
                          <span className="text-sm font-semibold text-gray-800">{name}</span>
                          {r.clients?.name && <span className="text-xs text-gray-400">· {r.clients.name}</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleString('it-IT')}</div>
                        {r.note && <div className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-lg p-2">{r.note}</div>}
                        {r.response_note && <div className="text-xs text-gray-500 mt-2">Esito: {r.response_note}</div>}
                      </div>
                      {(r.status === 'pending' || r.status === 'processing') && (
                        <div className="flex gap-2 flex-shrink-0">
                          {r.status === 'pending' && (
                            <button disabled={savingId === r.id} onClick={() => update(r.id, 'processing')} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100 disabled:opacity-50">In lavorazione</button>
                          )}
                          <button disabled={savingId === r.id} onClick={() => update(r.id, 'done')} className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl hover:bg-green-100 disabled:opacity-50">Evasa</button>
                          <button disabled={savingId === r.id} onClick={() => update(r.id, 'rejected')} className="text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-100 disabled:opacity-50">Respingi</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
            Le richieste arrivano dall&apos;area personale del dipendente. La revoca del consenso ha effetto immediato (registrata come &quot;evasa&quot;); accesso, rettifica e cancellazione vanno processate dal titolare nel rispetto degli obblighi di conservazione sanitaria.
          </p>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  let requests = [];
  try { requests = await getDataRequests(300); } catch (_) { requests = []; }
  return { props: { requests: JSON.parse(JSON.stringify(requests)) } };
});
