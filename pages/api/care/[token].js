import {
  getPatientByCareToken,
  createRestratAlert,
  insertCheckpoint,
} from '../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token } = req.query;
  const patient = await getPatientByCareToken(token);
  if (!patient) return res.status(404).json({ error: 'Token non valido' });

  const { mode, type, q1, q2, q2_nrs, q3, nrs, nrs_baseline, pain_zones, has_limitations, wants_contact } = req.body;

  try {
    if (mode === 'checkpoint') {
      await insertCheckpoint({
        patient_id: patient.id,
        client_id: patient.client_id,
        checkpoint_type: type === 't6' ? 't6' : 't3',
        nrs: nrs !== undefined && nrs !== null ? parseInt(nrs) : null,
        nrs_baseline: nrs_baseline !== undefined && nrs_baseline !== null ? parseInt(nrs_baseline) : null,
        pain_zones: pain_zones || [],
        has_limitations: has_limitations ?? null,
        wants_contact: wants_contact ?? null,
      });

      // Crea alert se vuole contatto o NRS è peggiorato (nrs > nrs_baseline)
      const nrsWorsened = nrs !== null && nrs_baseline !== null && parseInt(nrs) > parseInt(nrs_baseline);
      if (wants_contact || nrsWorsened) {
        await createRestratAlert({
          patient_id: patient.id,
          client_id: patient.client_id,
          source: 'checkpoint',
          form_data: { type, nrs, nrs_baseline, pain_zones, has_limitations, wants_contact },
        });
      }
    } else {
      // mode === 'self_trigger'
      const shouldAlert = q1 === true || (q2 === true && q2_nrs >= 5);
      if (shouldAlert) {
        await createRestratAlert({
          patient_id: patient.id,
          client_id: patient.client_id,
          source: 'self_trigger',
          form_data: { q1, q2, q2_nrs, q3 },
        });
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
