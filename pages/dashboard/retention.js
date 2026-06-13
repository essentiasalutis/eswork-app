import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getRetentionReview } from '../../lib/store';

function fmt(d) { return d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

export default function RetentionPage({ review }) {
  const [due, setDue] = useState(review.due || []);
  const [busyId, setBusyId] = useState(null);

  async function remove(p) {
    if (!window.confirm(`Cancellare definitivamente i dati di ${p.name}?\n\nIl termine di conservazione (${review.years} anni) è scaduto il ${fmt(p.retention_until)}. L'operazione è irreversibile e va registrata come adempimento.`)) return;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/patients/${p.id}`, { method: 'DELETE' });
      if (res.ok) setDue(prev => prev.filter(x => x.id !== p.id));
      else alert('Errore nella cancellazione');
    } catch { alert('Errore di rete'); }
    setBusyId(null);
  }

  return (
    <>
      <Head><title>Conservazione dati — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <div>
              <h1 className="font-bold text-gray-900">🗄️ Conservazione dati (retention)</h1>
              <p className="text-xs text-gray-500">Termine di conservazione: {review.years} anni dall&apos;ultima attività · {review.total} pazienti in conservazione</p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
            <strong>Cancellazione assistita (non automatica).</strong> Il sistema <em>segnala</em> qui i dati che hanno superato il termine di conservazione di {review.years} anni; la cancellazione è eseguita e validata dal titolare del trattamento (mai in automatico su dati sanitari). Le risposte anonime aggregate dell&apos;assessment restano negli aggregati e non sono riconducibili alla persona.
          </div>

          {/* DA CANCELLARE */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Oltre il termine — da cancellare ({due.length})</div>
            {due.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-500 text-sm">
                ✅ Nessun paziente oltre il termine di conservazione. Il sistema segnalerà qui i dati da cancellare alla scadenza dei {review.years} anni.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Paziente</th><th className="px-4 py-3">Azienda</th>
                    <th className="px-4 py-3">Ultima attività</th><th className="px-4 py-3">Termine scaduto il</th><th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {due.map(p => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{p.client || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-600">{fmt(p.last_activity)}</td>
                        <td className="px-4 py-2.5 text-red-600 font-semibold">{fmt(p.retention_until)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button disabled={busyId === p.id} onClick={() => remove(p)} className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-100 disabled:opacity-50">
                            {busyId === p.id ? '…' : 'Cancella (validato)'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* IN SCADENZA (informativo) */}
          {review.upcoming?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prossime scadenze (informativo)</div>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Paziente</th><th className="px-4 py-3">Azienda</th><th className="px-4 py-3">Termine</th>
                  </tr></thead>
                  <tbody>
                    {review.upcoming.map(p => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 text-gray-700">{p.name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{p.client || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500">{fmt(p.retention_until)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  let review = { total: 0, years: 10, due: [], upcoming: [] };
  try { review = await getRetentionReview(); } catch (_) {}
  return { props: { review: JSON.parse(JSON.stringify(review)) } };
});
