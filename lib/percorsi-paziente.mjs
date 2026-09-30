// Date dei percorsi di ogni persona, per la tabella Pazienti della scheda azienda.
// Decisione di Enrico (30/9): le date si compilano da sole quando l'osteopata registra il
// trattamento (una riga di `sessions` = una volta che ha visto la persona). Nessun pulsante
// «visitato»: sarebbe un doppione. La formazione resta fuori: la vede anche l'HR, e il
// dominio organizzativo non si collega a quello clinico.
// Modulo PURO: riceve cicli e sedute già letti, non tocca il database.
import { PROTOCOLLO } from './protocollo.mjs';

const quando = x => x.started_at || x.created_at || '';

export function percorsiDelPaziente(patientId, cicli, sedute, p = PROTOCOLLO) {
  const suoi = (cicli || []).filter(c => c.patient_id === patientId)
    .sort((a, b) => quando(a).localeCompare(quando(b)));
  const sue = (sedute || []).filter(s => s.patient_id === patientId)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const idCicli = new Set(suoi.map(c => c.id));
  const data = s => ({ il: s.date || s.closed_at || null, chiusa: !!s.closed_at });

  const conta = { treatment: 0, prevention: 0 };
  const percorsi = suoi.map(c => {
    const tipo = (c.cycle_type || 'treatment') === 'prevention' ? 'prevention' : 'treatment';
    conta[tipo] += 1;
    const date = sue.filter(s => s.cycle_id === c.id).map(data);
    return {
      id: c.id,
      tipo,
      numero: conta[tipo],
      stato: c.status || null,
      previste: c.sessions_planned || (tipo === 'prevention' ? p.sessioni_prevenzione_l2 : p.sedute_per_ciclo),
      fatte: date.filter(d => d.chiusa).length,
      date,
    };
  });
  // Sedute senza ciclo (registrate prima dei cicli o fuori percorso): si mostrano a parte.
  const fuori = sue.filter(s => !s.cycle_id || !idCicli.has(s.cycle_id)).map(data);
  return { percorsi, fuori };
}

export function nomePercorso(c) {
  return c.tipo === 'prevention' ? 'Prevenzione' : `Trattamento ${c.numero}`;
}

export function statoPercorso(c) {
  if (c.stato === 'closed') return 'concluso';
  if (c.stato === 'pending_pgic') return 'manca il PGIC';
  return null;
}
