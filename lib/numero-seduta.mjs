// Numero della seduta DENTRO il suo ciclo, per «Seduta 2 di 4 · ciclo 2».
// session_number è progressivo per paziente su tutti i cicli (lo assegna la
// cartella: sedute chiuse + 1), quindi al secondo ciclo diceva «Seduta 6 di 4».
// Qui si contano solo le sedute chiuse dello stesso ciclo, in ordine.
// Le sedute senza ciclo restano senza numero nel ciclo (null).
export function numeriNelCiclo(sessions) {
  const perCiclo = {};
  for (const s of sessions || []) {
    if (!s || !s.closed_at || !s.cycle_id) continue;
    (perCiclo[s.cycle_id] ||= []).push(s);
  }
  const numeri = {};
  for (const elenco of Object.values(perCiclo)) {
    elenco.sort((a, b) => (a.session_number || 0) - (b.session_number || 0)
      || String(a.date || a.closed_at).localeCompare(String(b.date || b.closed_at)));
    elenco.forEach((s, i) => { numeri[s.id] = i + 1; });
  }
  return numeri;
}
