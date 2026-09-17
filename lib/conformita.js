import { getDocumentComplianceByClient, getAllPatients } from './store';
import supabase from './db';
import { documentoValido, prevedeSedute } from './documenti-seduta.mjs';
import { MOTIVI } from './copia-cartacea.mjs';

// Dati della pagina di conformità (usati dall'API e dalla pagina, senza che la
// pagina chiami il proprio indirizzo).
// { aziende: [...], carta: {...} }
//  · aziende: per ogni azienda, i pazienti con un percorso di sedute (L1 e L2 con
//    prevenzione) e lo stato dei 3 documenti — con la STESSA regola dell'API delle
//    sedute (lib/documenti-seduta.mjs): un consenso vale solo se legato all'archivio.
//  · carta: quante firme su carta e perché, per osteopata. Serve a vedere se
//    l'eccezione sta diventando la regola (Enrico, 17/9).
export async function datiConformita() {
  const [docs, patients, copieRes, proRes] = await Promise.all([
    getDocumentComplianceByClient(),
    getAllPatients(),
    supabase.from('copie_cartacee').select('patient_id, professional_id, documento, motivo, caricato_il'),
    supabase.from('professionals').select('id, name'),
  ]);

  const patientsByClient = {};
  patients.filter(prevedeSedute).forEach(p => {
    if (!patientsByClient[p.client_id]) patientsByClient[p.client_id] = [];
    patientsByClient[p.client_id].push(p);
  });

  const docsByPatient = {};
  docs.forEach(d => { (docsByPatient[d.patient_id] ||= []).push(d); });

  const clientMap = {};
  Object.entries(patientsByClient).forEach(([clientId, pts]) => {
    const clientName = pts[0]?.clients?.name || docs.find(d => d.client_id === clientId)?.clients?.name || '—';
    let complete = 0, incomplete = 0;
    const patientDetails = pts.map(p => {
      const pdocs = docsByPatient[p.id] || [];
      const doc = t => pdocs.find(d => d.type === t);
      const hasConsent = documentoValido(doc('consent_treatment'));
      const hasPrivacy = documentoValido(doc('privacy_extended'));
      const hasAnamnesi = documentoValido(doc('anamnesi'));
      const isComplete = hasConsent && hasPrivacy && hasAnamnesi;
      if (isComplete) complete++; else incomplete++;
      return {
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        level: p.level,
        consent: hasConsent,
        privacy: hasPrivacy,
        anamnesi: hasAnamnesi,
        suCarta: pdocs.some(d => d.modalita === 'carta'),
        complete: isComplete,
      };
    });
    clientMap[clientId] = { clientId, clientName, complete, incomplete, total: pts.length, patients: patientDetails };
  });

  // Carta vs piattaforma: si conta per PAZIENTE (un caricamento può contenere
  // entrambi i consensi). Piattaforma = consenso valido firmato in piattaforma.
  const copie = copieRes.data || [];
  const nomi = Object.fromEntries((proRes.data || []).map(p => [p.id, p.name]));
  const consensiValidi = docs.filter(d => d.type === 'consent_treatment' && documentoValido(d));
  const perMotivo = Object.fromEntries(Object.keys(MOTIVI).map(k => [k, 0]));
  const caricamenti = new Map();   // un caricamento = paziente + istante
  copie.forEach(c => caricamenti.set(`${c.patient_id}|${c.caricato_il}`, c));
  caricamenti.forEach(c => { perMotivo[c.motivo] = (perMotivo[c.motivo] || 0) + 1; });
  const perOsteopata = {};
  caricamenti.forEach(c => {
    const k = c.professional_id;
    (perOsteopata[k] ||= { id: k, nome: nomi[k] || k, caricamenti: 0, motivi: {} });
    perOsteopata[k].caricamenti++;
    perOsteopata[k].motivi[c.motivo] = (perOsteopata[k].motivi[c.motivo] || 0) + 1;
  });

  return {
    aziende: Object.values(clientMap).sort((a, b) => b.total - a.total),
    carta: {
      consensiInPiattaforma: consensiValidi.filter(d => d.modalita !== 'carta').length,
      consensiSuCarta: consensiValidi.filter(d => d.modalita === 'carta').length,
      caricamenti: caricamenti.size,
      perMotivo,
      motivi: MOTIVI,
      perOsteopata: Object.values(perOsteopata).sort((a, b) => b.caricamenti - a.caricamenti),
    },
  };
}
