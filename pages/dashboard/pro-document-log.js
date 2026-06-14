import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getProDocAccessLogs } from '../../lib/store';

const ACTION_LABEL = {
  upload_pro_doc: 'Caricamento',
  view_pro_doc: 'Apertura / download',
  delete_pro_doc: 'Eliminazione',
};
const ACTION_COLOR = {
  upload_pro_doc: '#7c3aed',
  view_pro_doc: '#0891b2',
  delete_pro_doc: '#dc2626',
};
const DOC_LABEL = {
  identity: 'Documento identità',
  albo: 'Iscrizione albo',
  rc_policy: 'Polizza RC',
  rc_receipt: 'Quietanza RC',
  contract: 'Contratto',
};

export default function ProDocLogPage({ logs }) {
  return (
    <>
      <Head><title>Registro accessi documenti — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <div>
              <h1 className="font-bold text-gray-900">📁 Registro accessi — documenti professionisti</h1>
              <p className="text-xs text-gray-500">Audit trail dei documenti di conformità (art. 6.1.b), distinto dagli accessi clinici · ultimi {logs.length} eventi</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6">
          {logs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">
              Nessun accesso registrato.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Quando</th>
                    <th className="px-4 py-3">Chi</th>
                    <th className="px-4 py-3">Azione</th>
                    <th className="px-4 py-3">Documento</th>
                    <th className="px-4 py-3">IP (hash)</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const color = ACTION_COLOR[l.action] || '#64748b';
                    const subject = l.professionals?.name || (l.professional_id ? '(professionista rimosso)' : '—');
                    // Un osteopata accede solo ai PROPRI documenti → l'attore pro coincide col soggetto.
                    const actor = l.actor_type === 'admin' ? `Titolare · ${l.actor_id || '—'}` : `${subject} (osteopata)`;
                    return (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{new Date(l.created_at).toLocaleString('it-IT')}</td>
                        <td className="px-4 py-2.5 text-gray-800 font-medium">{actor}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: color + '18', color }}>
                            {ACTION_LABEL[l.action] || l.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {DOC_LABEL[l.doc_type] || l.doc_type || '—'} <span className="text-gray-400">· di {subject}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{l.ip_hash || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
            Registro DEDICATO ai documenti del professionista, separato dal registro degli accessi ai dati clinici dei pazienti. L'IP è conservato solo in forma anonimizzata (hash non reversibile).
          </p>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  let logs = [];
  try { logs = await getProDocAccessLogs(300); } catch (_) {}
  return { props: { logs: JSON.parse(JSON.stringify(logs)) } };
});
