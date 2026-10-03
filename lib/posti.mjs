// ─────────────────────────────────────────────────────────────────────────────
// POSTI PER I NUOVI INGRESSI — quali cicli li consumano. Modulo PURO (testato).
//
// Decisioni di Enrico (Art. 5-ter, 3-4/10):
//  · il prezzo comprende, per ogni persona messa nel prezzo dal Report di Attivazione,
//    UN ciclo: il primo ciclo di trattamento dell'anno per chi è nel prezzo come L1, il
//    primo ciclo di prevenzione per chi è nel prezzo come L2;
//  · ogni altro ciclo consuma un posto: il primo ciclo di chi è entrato in Livello 1
//    dopo (autosegnalazione, promozione, neoassunto), OGNI secondo ciclo da qualunque
//    strada arrivi (autosegnalazione, mini-check, rivalutazione), la prevenzione dei
//    neoassunti in L2;
//  · il posto si consuma all'AVVIO del ciclo (presa in carico), mai in coda.
// «Nel prezzo» è un segno fissato sul paziente quando si genera il Report (v84): il
// livello calcolato non basta, perché il check-up annuale e le riclassificazioni lo
// riscrivono (a Officine, dopo l'annuale, 18 L1 contro i 39 del check-up iniziale).
// ─────────────────────────────────────────────────────────────────────────────

const quando = c => c.started_at || c.created_at || '';
const tipoDi = c => (c.cycle_type || 'treatment') === 'prevention' ? 'prevention' : 'treatment';

// cicli: righe di treatment_cycles già filtrate sull'anno di programma.
// nelPrezzo: { patientId: 'level1' | 'level2' }. neoassunti: Set di patientId.
export function classificaCicli({ cicli = [], nelPrezzo = {}, neoassunti = new Set() } = {}) {
  const ordinati = [...cicli].sort((a, b) => String(quando(a)).localeCompare(String(quando(b))));
  const visti = {};   // patientId:tipo → quanti cicli di quel tipo già avviati nell'anno
  const esito = { inclusiL1: 0, inclusiL2: 0, nuoviL1: 0, secondiCicli: 0, prevenzioniNeoassunti: 0, cicli: [] };
  for (const c of ordinati) {
    const tipo = tipoDi(c);
    const chiave = `${c.patient_id}:${tipo}`;
    const n = (visti[chiave] = (visti[chiave] || 0) + 1);
    const neo = neoassunti.has(c.patient_id);
    const livello = neo ? null : nelPrezzo[c.patient_id] || null;
    let voce;
    if (tipo === 'treatment') voce = n > 1 ? 'secondo' : livello === 'level1' ? 'incluso' : 'nuovo_l1';
    else voce = n === 1 && livello === 'level2' ? 'incluso' : 'prevenzione_fuori';
    if (voce === 'incluso') tipo === 'treatment' ? esito.inclusiL1++ : esito.inclusiL2++;
    else if (voce === 'nuovo_l1') esito.nuoviL1++;
    else if (voce === 'secondo') esito.secondiCicli++;
    else esito.prevenzioniNeoassunti++;
    esito.cicli.push({ id: c.id, patient_id: c.patient_id, tipo, voce });
  }
  esito.consumati = esito.nuoviL1 + esito.secondiCicli + esito.prevenzioniNeoassunti;
  return esito;
}

// Il ciclo che sta per partire consuma un posto? Stessa regola, per una persona.
// cicliPersona: i cicli di quella persona già avviati nell'anno di programma.
export function nuovoCicloConsuma({ tipo = 'treatment', cicliPersona = [], nelPrezzo = null, neoassunto = false } = {}) {
  const giaDelTipo = cicliPersona.filter(c => tipoDi(c) === tipo).length;
  if (giaDelTipo > 0) return true;
  if (neoassunto) return true;
  return !(tipo === 'treatment' ? nelPrezzo === 'level1' : nelPrezzo === 'level2');
}
