/**
 * /q/[share_code] — DEPRECATO (vecchio flusso campagna anonima).
 *
 * Il modello v4 prevede UN SOLO flusso di adesione: /q/c/[client_code]
 * (auto-dichiarazione riservata). Questa pagina reindirizza al nuovo flusso
 * usando l'assessment_share_code del cliente associato all'assessment.
 */

import { getAssessmentByShareCode, getClientById, ensureClientAssessmentShareCode } from '../../lib/store';

export default function DeprecatedAssessmentRedirect() {
  // Renderizzato solo se il redirect non è stato possibile (link non valido).
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Link non valido</h1>
        <p className="text-gray-500">Questo link non è più attivo. Richiedi il link aggiornato alla tua azienda.</p>
      </div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  const { share_code } = params;
  try {
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) return { props: {} };

    let code = null;
    const client = await getClientById(assessment.client_id).catch(() => null);
    code = client?.assessment_share_code || await ensureClientAssessmentShareCode(assessment.client_id).catch(() => null);

    if (!code) return { props: {} };
    return { redirect: { destination: `/q/c/${code}`, permanent: false } };
  } catch {
    return { props: {} };
  }
}
