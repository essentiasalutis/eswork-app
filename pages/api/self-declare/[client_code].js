// POST /api/self-declare/[client_code]
// Crea un paziente auto-dichiarato e salva le risposte NMQ

import {
  getClientByAssessmentShareCode,
  createSelfDeclaredPatient,
  insertResponse,
  insertAssessmentConsent,
  updatePatient,
  addToWaitlist,
  generateId,
} from '../../../lib/store';
import { computeLevel } from '../../../lib/scoring';
import { hashIp } from '../../../lib/crypto-utils';
import { getClientIp } from '../../../lib/rate-limit';
import { statoCheckupCliente } from '../../../lib/checkup-server';
import { etichettaData, etichettaOra } from '../../../lib/checkup';

// Messaggio al dipendente quando il check-up è chiuso: onesto e senza dettagli tecnici.
function messaggioChiuso(st, inviate) {
  if (st.stato === 'non_avviato') return 'Il check-up non è ancora aperto.';
  const quando = st.chiusoAlle
    ? `il ${etichettaData(new Date(st.chiusoAlle).toISOString().slice(0, 10))} alle ${etichettaOra(st.chiusoAlle)}`
    : (st.chiudeIl ? `il ${etichettaData(st.chiudeIl)}` : '');
  return inviate
    ? `Il check-up si è chiuso${quando ? ' ' + quando : ''}: queste risposte non sono state registrate. Grazie per il tempo che ci hai dedicato.`
    : `Il check-up si è chiuso${quando ? ' ' + quando : ''}. Grazie per l'interesse.`;
}

export default async function handler(req, res) {
  const { client_code } = req.query;

  if (req.method === 'GET') {
    const client = await getClientByAssessmentShareCode(client_code);
    if (!client) return res.status(404).json({ error: 'Link non valido' });
    const st = await statoCheckupCliente(client).catch(() => null);
    return res.json({
      client: { id: client.id, name: client.name },
      checkup: st ? { stato: st.stato, chiude_il: st.chiudeIl, messaggio: st.accetta ? null : messaggioChiuso(st, false) } : null,
    });
  }

  if (req.method === 'POST') {
    const client = await getClientByAssessmentShareCode(client_code);
    if (!client) return res.status(404).json({ error: 'Link non valido' });

    const {
      first_name,
      last_name,
      email,
      phone,
      location,
      wants_to_be_contacted,
      answers,
      consent_privacy,
      consent_health,
      informativa_version,
    } = req.body || {};

    // GATE CONSENSO: nessun dato (anche di salute, art.9) viene trattato senza
    // entrambi i consensi espliciti. Difesa lato server, non solo gate UI.
    if (consent_privacy !== true || consent_health !== true) {
      return res.status(400).json({ error: 'Consensi obbligatori mancanti: privacy e dati di salute.' });
    }

    // GATE CHECK-UP — PRIMA di creare qualunque cosa. Prima di questo gate il
    // record del dipendente nasceva comunque e la risposta si perdeva in silenzio
    // se il check-up era chiuso. Ora: chiuso = nulla salvato, e lo si dice.
    // All'invio vale la grazia (lib/checkup.js): chi aveva iniziato in tempo non perde le risposte.
    let st;
    try { st = await statoCheckupCliente(client, { conGrazia: true }); }
    catch (_) { return res.status(503).json({ error: 'Servizio momentaneamente non disponibile, riprova tra qualche minuto.' }); }
    if (!st.accetta) {
      return res.status(410).json({ codice: 'checkup_chiuso', error: messaggioChiuso(st, true) });
    }

    try {
      // 1. Crea il record paziente
      const patient = await createSelfDeclaredPatient({
        client_id: client.id,
        first_name: wants_to_be_contacted ? first_name : null,
        last_name: wants_to_be_contacted ? last_name : null,
        email: wants_to_be_contacted ? email : null,
        phone: wants_to_be_contacted ? phone : null,
        location: location || null,
        wants_to_be_contacted: !!wants_to_be_contacted,
      });

      // 2. Calcola livello
      const computed_level = answers ? computeLevel(answers) : 'level3';
      const now = new Date().toISOString();

      // Diritto alla prevenzione attiva fissato a inizio anno (regola opzione A):
      // spetta ai L2 dall'assessment SOLO nei tier Plus/Enterprise.
      const n = parseInt(client.employees) || 0;
      const tier = client.tier || (n <= 150 ? 'core' : n <= 500 ? 'plus' : 'enterprise');
      const prevention_eligible = computed_level === 'level2' && (tier === 'plus' || tier === 'enterprise');

      // 3. Aggiorna livello sul paziente (non-fatale se fallisce)
      //    L1 dall'assessment è solo CANDIDATO: level_status='pending' finché non
      //    passa dalla pre-validazione. Il level confermato (active) lo dà solo la
      //    pre-validazione con esito l1_confirmed. L2/L3 non richiedono conferma.
      await updatePatient(patient.id, {
        computed_level,
        level: computed_level,
        level_status: computed_level === 'level1' ? 'pending' : 'active',
        prevention_eligible,
        assessment_completed_at: now,
      }).catch(e => console.error('updatePatient error:', e.message));

      // 4. Salva le risposte NMQ nell'analisi del check-up — SOLO se è aperta.
      //    In adesione (azienda firmata, check-up chiuso) la persona entra nel
      //    programma ma l'analisi, base del Report di Attivazione, resta intatta.
      const assessment = st.salvaRisposta ? st.assessment : null;
      if (assessment && answers) {
        await insertResponse({
          id: generateId('r'),
          assessment_id: assessment.id,
          answers,
          submitted_at: now,
        }).catch(e => console.error('insertResponse error:', e.message));
      }

      // 4-bis. PROVA DEL CONSENSO (persistita e riconducibile): chi (patient_id),
      //        a cosa (privacy + salute art.9), quale versione dell'informativa,
      //        quando (timestamp), con quale impronta tecnica (ip_hash, user_agent).
      await insertAssessmentConsent({
        assessment_id: assessment?.id || null,
        patient_id: patient.id,
        consent_privacy_at: now,
        consent_health_at: now,
        informativa_version: informativa_version || null,
        ip_hash: hashIp(getClientIp(req)),
        user_agent: (req.headers['user-agent'] || '').slice(0, 200) || null,
      }).catch(e => console.error('insertAssessmentConsent error:', e.message));

      // 5. Se vuole essere contattato E risulta L1 → Waitlist
      if (wants_to_be_contacted && computed_level === 'level1') {
        // NB: la tabella waitlist non ha assessment_id (il collegamento è via patient)
        await addToWaitlist({
          patient_id: patient.id,
          client_id: client.id,
          score: 100,
          source: 'self_declaration',
          status: 'pending',
        }).catch(e => console.error('addToWaitlist error:', e.message));
      }

      return res.status(201).json({
        ok: true,
        level: computed_level,
        patient_id: patient.id,
        // Link area personale (self-trigger, mini-check, re-assessment)
        care_token: wants_to_be_contacted ? patient.care_token : null,
      });
    } catch (e) {
      console.error('self-declare POST error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
