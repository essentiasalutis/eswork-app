// Conservazione della documentazione clinica — lettura dalla banca dati.
// Regola pura in lib/conservazione.mjs. Nel dubbio si conserva: se una lettura
// fallisce, la cancellazione non parte.
import supabase from './db';
import { PROTOCOLLO } from './protocollo.mjs';
import { TABELLE_CLINICHE, esitoConservazione, messaggioConservazione } from './conservazione.mjs';
import { dataIt } from './date-it.mjs';

export const ANNI_CONSERVAZIONE = PROTOCOLLO.anni_conservazione;

// Esito per un insieme di pazienti. Ritorna { bloccato, esito, errore }.
async function righeCliniche(patientIds) {
  const righe = {};
  for (const { tabella, date } of TABELLE_CLINICHE) {
    const { data, error } = await supabase.from(tabella).select(['patient_id', ...date].join(', ')).in('patient_id', patientIds);
    if (error) throw new Error(`verifica della conservazione non riuscita su ${tabella}: ${error.message}`);
    righe[tabella] = data || [];
  }
  return righe;
}

export async function vincoloConservazionePaziente(patientId, nome) {
  const righe = await righeCliniche([patientId]);
  const esito = esitoConservazione(righe, ANNI_CONSERVAZIONE);
  return { ...esito, messaggio: esito.bloccato ? messaggioConservazione(esito, ANNI_CONSERVAZIONE, nome) : null };
}

// Per un'azienda: blocca se ANCHE UN SOLO paziente ha documentazione in conservazione.
export async function vincoloConservazioneAzienda(clientId) {
  const { data: pazienti, error } = await supabase.from('patients').select('id, first_name, last_name').eq('client_id', clientId);
  if (error) throw new Error(`verifica della conservazione non riuscita: ${error.message}`);
  const ids = (pazienti || []).map(p => p.id);
  // Anche i record clinici rimasti con client_id ma senza paziente contano.
  const orfani = {};
  for (const t of ['sessions', 'patient_documents', 'copie_cartacee']) {
    const { data, error: e } = await supabase.from(t).select('patient_id').eq('client_id', clientId);
    if (e) throw new Error(`verifica della conservazione non riuscita su ${t}: ${e.message}`);
    (data || []).forEach(r => { if (r.patient_id && !ids.includes(r.patient_id)) orfani[r.patient_id] = true; });
  }
  const tutti = [...ids, ...Object.keys(orfani)];
  if (!tutti.length) return { bloccato: false, pazienti: 0 };
  const righe = await righeCliniche(tutti);
  const bloccati = [];
  for (const id of tutti) {
    const perPaziente = Object.fromEntries(Object.entries(righe).map(([t, r]) => [t, r.filter(x => x.patient_id === id)]));
    const esito = esitoConservazione(perPaziente, ANNI_CONSERVAZIONE);
    if (esito.bloccato) bloccati.push({ id, finoAl: esito.finoAl });
  }
  if (!bloccati.length) return { bloccato: false, pazienti: tutti.length };
  const ultimo = bloccati.map(b => b.finoAl).sort().pop();
  return {
    bloccato: true,
    pazienti: bloccati.length,
    finoAl: ultimo,
    messaggio: `Cancellazione dell'azienda non eseguita: ${bloccati.length === 1 ? '1 paziente ha' : `${bloccati.length} pazienti hanno`} documentazione clinica ancora nel periodo di conservazione di ${ANNI_CONSERVAZIONE} anni (l'ultima fino al ${dataIt(ultimo)}). Va conservata fino ad allora.`,
  };
}
