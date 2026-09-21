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
import { limiteCheckup, MESSAGGIO_LIMITE } from '../../../lib/limite-checkup';
import { sessioneConsensiValida, collegaSessioneAPaziente } from '../../../lib/testi-legali-server';
import { statoCheckupCliente } from '../../../lib/checkup-server';
import { ilGiorno, etichettaOra, oggiRoma as giornoRoma } from '../../../lib/checkup';

// Messaggio al dipendente quando il check-up è chiuso: onesto e senza dettagli tecnici.
function messaggioChiuso(st, inviate) {
  if (st.stato === 'non_avviato') return 'Il check-up non è ancora aperto.';
  const quando = st.chiusoAlle
    ? `${ilGiorno(giornoRoma(st.chiusoAlle))} alle ${etichettaOra(st.chiusoAlle)}`
    : (st.chiudeIl ? ilGiorno(st.chiudeIl) : '');
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
    // Demo permanente (v78): lo decide il server dall'azienda, non il browser.
    const demo = !!client.demo_permanente;
    const limite = limiteCheckup(req, { fase: 'invio', clientId: client.id, demo });
    if (!limite.ok) return res.status(429).json({ error: MESSAGGIO_LIMITE });

    const {
      first_name,
      last_name,
      email,
      phone,
      location,
      wants_to_be_contacted,
      answers,
      consensi_sessione_id,
    } = req.body || {};

    // GATE CONSENSO (v64): i consensi sono già registrati dal server, UNO PER
    // CASELLA, alla conferma della schermata — con la versione decisa dal server.
    // Qui si verifica che quella sessione esista, sia recente, completa e non
    // ancora usata. Niente più valori «true» scritti fissi nella pagina: senza
    // una sessione valida non si tratta nessun dato, nemmeno di salute.
    const consensi = await sessioneConsensiValida(consensi_sessione_id, 'informativa_checkup').catch(() => null);
    // Una sessione di consensi della demo vale solo per la demo, e viceversa (21/9).
    if (consensi && consensi.some(r => (r.canale === 'checkup_demo') !== demo)) {
      return res.status(400).json({ error: 'Consensi non validi per questo check-up: torna alla schermata dei consensi e confermali di nuovo.' });
    }
    if (!consensi) {
      return res.status(400).json({ error: 'Consensi obbligatori mancanti o scaduti: torna alla schermata dei consensi e confermali di nuovo.' });
    }
    const versioneAccettata = consensi[0].versione;

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
      // Demo: anonima per costruzione — nessun contatto, nessuna sede, qualunque cosa
      // arrivi dal browser (21/9).
      const contatto = !!wants_to_be_contacted && !demo;
      const patient = await createSelfDeclaredPatient({
        client_id: client.id,
        first_name: contatto ? first_name : null,
        last_name: contatto ? last_name : null,
        email: contatto ? email : null,
        phone: contatto ? phone : null,
        location: demo ? null : (location || null),
        wants_to_be_contacted: contatto,
      });

      // 2. Calcola livello
      const computed_level = answers ? computeLevel(answers) : 'level3';
      const now = new Date().toISOString();

      // Diritto alla prevenzione attiva, fissato al check-up (regola opzione A):
      // spetta a OGNI Livello 2, in qualunque configurazione (Enrico, 12/9).
      const prevention_eligible = computed_level === 'level2';

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

      // 4-bis. PROVA DEL CONSENSO: le righe del registro (v64) si collegano al
      //        paziente appena nato. È l'unico aggiornamento che la banca dati ammette.
      await collegaSessioneAPaziente(consensi_sessione_id, patient.id)
        .catch(e => console.error('collegaSessioneAPaziente error:', e.message));

      // Compatibilità: assessment_consents resta letta da scheda azienda ed export.
      // Le date ora sono quelle REALI di ciascun consenso e la versione quella
      // decisa dal server. La prova vera è in consensi_registrati.
      const at = k => (consensi.find(r => r.consenso === k) || {}).atto_at || now;
      await insertAssessmentConsent({
        assessment_id: assessment?.id || null,
        patient_id: patient.id,
        consent_privacy_at: at('privacy'),
        consent_health_at: at('salute'),
        informativa_version: versioneAccettata,
        ip_hash: demo ? null : hashIp(getClientIp(req)),
        user_agent: demo ? null : ((req.headers['user-agent'] || '').slice(0, 200) || null),
      }).catch(e => console.error('insertAssessmentConsent error:', e.message));

      // 5. Se vuole essere contattato E risulta L1 → Waitlist
      if (contatto && computed_level === 'level1') {
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
        // Demo: il livello non esce nemmeno nella risposta (la schermata finale non lo dice).
        level: demo ? null : computed_level,
        patient_id: patient.id,
        // Link area personale (self-trigger, mini-check, re-assessment)
        care_token: contatto ? patient.care_token : null,
      });
    } catch (e) {
      console.error('self-declare POST error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
