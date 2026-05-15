import { requireAuth } from '../../../lib/auth';
import { getDocumentComplianceByClient, getAllPatients } from '../../../lib/store';

// GET /api/admin/compliance
// Restituisce per ogni azienda: n pazienti L1, documenti completi/incompleti
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const [docs, patients] = await Promise.all([
      getDocumentComplianceByClient(),
      getAllPatients(),
    ]);

    // Pazientil1 per azienda
    const patientsByClient = {};
    patients.filter(p => p.level === 'level1').forEach(p => {
      if (!patientsByClient[p.client_id]) patientsByClient[p.client_id] = [];
      patientsByClient[p.client_id].push(p);
    });

    // Documenti per paziente
    const docsByPatient = {};
    docs.forEach(d => {
      if (!docsByPatient[d.patient_id]) docsByPatient[d.patient_id] = [];
      docsByPatient[d.patient_id].push(d);
    });

    // Aggrega per azienda
    const clientMap = {};
    Object.entries(patientsByClient).forEach(([clientId, pts]) => {
      const clientName = pts[0]?.clients?.name || docs.find(d => d.client_id === clientId)?.clients?.name || '—';
      let complete = 0, incomplete = 0;
      const patientDetails = pts.map(p => {
        const pdocs = docsByPatient[p.id] || [];
        const hasConsent = pdocs.some(d => d.type === 'consent_treatment' && d.status === 'signed');
        const hasPrivacy = pdocs.some(d => d.type === 'privacy_extended' && d.status === 'signed');
        const hasAnamnesi = pdocs.some(d => d.type === 'anamnesi' && d.status === 'completed');
        const isComplete = hasConsent && hasPrivacy && hasAnamnesi;
        if (isComplete) complete++; else incomplete++;
        return {
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          consent: hasConsent,
          privacy: hasPrivacy,
          anamnesi: hasAnamnesi,
          complete: isComplete,
        };
      });
      clientMap[clientId] = { clientId, clientName, complete, incomplete, total: pts.length, patients: patientDetails };
    });

    return res.json(Object.values(clientMap).sort((a, b) => b.total - a.total));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
