import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getAccessLogs } from '../../lib/store';

const ACTION_LABEL = {
  login: 'Login',
  logout: 'Logout',
  view_patient: 'Apertura cartella',
  view_documents: 'Lettura documenti',
  sign_document: 'Firma documento',
  sign_documents: 'Firma documenti',
  close_session: 'Chiusura seduta',
  edit_session: 'Modifica seduta',
  reclassify: 'Riclassificazione',
};
const ACTION_COLOR = {
  login: '#64748b', logout: '#94a3b8',
  view_patient: '#2563eb', view_documents: '#0891b2',
  sign_document: '#7c3aed', sign_documents: '#7c3aed',
  close_session: '#16a34a', edit_session: '#ca8a04', reclassify: '#dc2626',
};

export default function AccessLogsPage({ logs }) {
  return (
    <>
      <Head><title>Registro accessi — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <div>
              <h1 className="font-bold text-gray-900">🔒 Registro accessi ai dati clinici</h1>
              <p className="text-xs text-gray-500">Audit trail: chi ha avuto accesso a cosa e quando · ultimi {logs.length} eventi</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6">
          {logs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">
              Nessun accesso registrato.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Quando</th>
                    <th className="px-4 py-3">Professionista</th>
                    <th className="px-4 py-3">Azione</th>
                    <th className="px-4 py-3">Paziente</th>
                    <th className="px-4 py-3">IP (hash)</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => {
                    const color = ACTION_COLOR[l.action] || '#64748b';
                    const patientName = l.patients ? `${l.patients.first_name || ''} ${l.patients.last_name || ''}`.trim() : null;
                    return (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{new Date(l.created_at).toLocaleString('it-IT')}</td>
                        <td className="px-4 py-2.5 text-gray-800 font-medium">{l.professionals?.name || l.professional_id || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: color + '18', color }}>
                            {ACTION_LABEL[l.action] || l.action}
                          </span>
                          {l.details && <span className="text-xs text-gray-400 ml-2">{l.details}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{patientName || (l.patient_id ? '(paziente rimosso)' : '—')}</td>
                        <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{l.ip_hash || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
            L'IP è conservato solo in forma anonimizzata (hash non reversibile). Il registro è consultabile dal solo titolare del trattamento.
          </p>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  let logs = [];
  try {
    logs = await getAccessLogs(300);
  } catch (_) {
    logs = [];
  }
  return { props: { logs: JSON.parse(JSON.stringify(logs)) } };
});
