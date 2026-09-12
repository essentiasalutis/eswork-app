// ─────────────────────────────────────────────────────────────────────────────
// Registro delle LETTURE dei dati clinici.
//
// Perché (12/9): il registro accessi esisteva già, ma le sue chiamate stavano su
// endpoint API che l'interfaccia non usa — le pagine si costruiscono sul server e
// leggono la banca dati direttamente. Risultato: in cinque mesi 19 login e 1 logout,
// e nessuna traccia di chi avesse aperto una cartella. Qui si registra dove la
// lettura avviene davvero.
//
// COSA SI SCRIVE: chi (professionista), quando, quale record, da dove (impronta
// dell'indirizzo, mai in chiaro). MAI un contenuto clinico: niente nomi di zone,
// niente note, niente valori.
//
// SCELTE DICHIARATE (Enrico, 12/9):
//  · best-effort: se il registro non scrive, la pagina si apre lo stesso. La
//    rigidità opposta (niente registro → niente accesso) renderebbe la piattaforma
//    ostaggio di un singhiozzo della banca dati. Va detto nel fascicolo.
//  · una riga per apertura, senza accorpare le riaperture ravvicinate.
//  · il fallimento non è silenzioso: si tenta una riga 'audit_failure' (utile quando
//    a fallire è la singola riga, non la banca dati) e si scrive comunque nel log
//    applicativo, che su Vercel resta consultabile.
//  · conservazione dichiarata: 24 mesi. La cancellazione automatica delle righe più
//    vecchie è in lista, non è implementata qui.
// ─────────────────────────────────────────────────────────────────────────────
import { logAccess } from './store';
import { getClientIp } from './rate-limit';
import supabase from './db';

export const AZIONI = {
  CARTELLA: 'view_patient',
  SEDUTA: 'view_session',
  ELENCO: 'view_patient_list',
};

export async function registraLettura(req, { proId, azione, patientId = null, dettaglio = null }) {
  const esito = await logAccess({
    professional_id: proId || null,
    action: azione,
    patient_id: patientId,
    ip: req ? getClientIp(req) : null,
    user_agent: req && req.headers ? req.headers['user-agent'] : null,
    details: dettaglio,
  }).catch(e => ({ ok: false, motivo: e.message }));

  if (esito && esito.ok && esito.ridotta) {
    // La riga c'è (chi, quando, che azione) ma ha perso il collegamento al record.
    console.error(`[registro accessi] riga RIDOTTA — ${azione}${patientId ? ` su ${patientId}` : ''}: ${esito.motivo}`);
    return true;
  }
  if (esito && esito.ok) return true;

  const motivo = (esito && esito.motivo) || 'errore sconosciuto';
  console.error(`[registro accessi] riga NON scritta — ${azione}${patientId ? ` su ${patientId}` : ''}: ${motivo}`);
  // Traccia durevole quando a fallire è la singola riga (per esempio un riferimento
  // non valido) e non l'intera banca dati: senza paziente collegato e senza dettagli
  // del record, solo il motivo tecnico.
  await supabase.from('access_logs').insert({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    professional_id: proId || null,
    action: 'audit_failure',
    details: `${azione}: ${String(motivo).slice(0, 200)}`,
  }).then(() => {}, () => {});
  return false;
}
