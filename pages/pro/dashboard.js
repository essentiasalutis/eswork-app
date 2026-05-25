import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import { getAssignmentsByProfessional, getPatientsByClient } from '../../lib/store';

function ProHeader({ proName, onLogout }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-gray-900">ES </span>
          <span className="text-xl font-bold text-green-600">Work</span>
          <span className="text-xs text-gray-400 ml-2">area professionista</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">{proName}</span>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50"
          >
            Esci
          </button>
        </div>
      </div>
      {/* Watermark sottile */}
      <div className="text-center text-xs text-gray-300 pb-1">{proName} — Essentia Salutis</div>
    </header>
  );
}

export default function ProDashboard({ proName, clients }) {
  async function logout() {
    await fetch('/api/pro/auth/logout', { method: 'POST' });
    window.location.href = '/pro/login';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProHeader proName={proName} onLogout={logout} />

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Link area osteopata */}
        <Link href="/osteopath/dashboard"
          className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-3 mb-5 hover:bg-green-100 transition-colors">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-sm">🌿</div>
          <div className="flex-1">
            <div className="font-semibold text-green-800 text-sm">Area Osteopata</div>
            <div className="text-xs text-green-600">Pre-validazioni, sessioni, schede pazienti</div>
          </div>
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <h1 className="text-xl font-bold text-gray-900 mb-1">Le tue aziende</h1>
        <p className="text-sm text-gray-500 mb-5">Seleziona un&apos;azienda per vedere i pazienti assegnati.</p>

        {clients.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🏢</div>
            <p>Nessuna azienda assegnata.<br />Contatta Essentia Salutis per l&apos;attivazione.</p>
          </div>
        )}

        <div className="space-y-3">
          {clients.map(({ client, patientCount }) => (
            <Link
              key={client.id}
              href={`/pro/clients/${client.id}/patients`}
              className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{client.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {client.employees} dip. · {client.sector === 1 ? 'Manifattura' : 'Ufficio/IT'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{patientCount}</div>
                  <div className="text-xs text-gray-400">pazienti</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const proId = ctx.req.proSession.proId;
  const proName = ctx.req.proSession.proName;

  if (ctx.req.proSession.mustReset) {
    return { redirect: { destination: '/pro/reset-password', permanent: false } };
  }

  const assignments = await getAssignmentsByProfessional(proId);
  const clients = await Promise.all(
    assignments.map(async (a) => {
      const patients = await getPatientsByClient(a.client_id);
      return { client: a.clients, patientCount: patients.length };
    })
  );

  return { props: { proName, clients } };
});
