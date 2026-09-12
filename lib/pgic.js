// ─────────────────────────────────────────────────────────────────────────────
// PGIC — le parole della scala, in un posto solo.
//
// Regola (Enrico, 12/9): al dipendente si rimostra ESATTAMENTE la parola che ha
// scelto quando ha risposto. Se legge un termine diverso sembra che il sistema
// abbia reinterpretato la sua risposta.
//
// Attenzione: i questionari usano DUE formulazioni diverse della stessa scala —
// il mini-check e il PGIC di fine ciclo dicono «Molto meglio / Meglio / Invariato /
// Peggio / Molto peggio», la rivalutazione annuale dice «Molto migliorato /
// Migliorato / Invariato / Peggiorato / Molto peggiorato». Non si uniformano qui:
// cambiare la parola di un questionario già somministrato cambierebbe ciò che le
// persone hanno letto. Ogni riga del percorso usa la formulazione della propria
// origine. (Che le due formulazioni convivano è una cosa da decidere con Enrico.)
// ─────────────────────────────────────────────────────────────────────────────

// Mini-check T3/T6 e PGIC di fine ciclo.
export const PGIC_MEGLIO = [
  { value: 5, label: 'Molto meglio', icon: '😄', color: '#16a34a' },
  { value: 4, label: 'Meglio', icon: '🙂', color: '#22c55e' },
  { value: 3, label: 'Invariato', icon: '😐', color: '#ca8a04' },
  { value: 2, label: 'Peggio', icon: '🙁', color: '#ea580c' },
  { value: 1, label: 'Molto peggio', icon: '😢', color: '#dc2626' },
];

// Rivalutazione annuale (T12).
export const PGIC_MIGLIORATO = [
  { value: 5, label: 'Molto migliorato', icon: '😄', color: '#16a34a' },
  { value: 4, label: 'Migliorato', icon: '🙂', color: '#22c55e' },
  { value: 3, label: 'Invariato', icon: '😐', color: '#ca8a04' },
  { value: 2, label: 'Peggiorato', icon: '🙁', color: '#ea580c' },
  { value: 1, label: 'Molto peggiorato', icon: '😢', color: '#dc2626' },
];

// scala: 'meglio' (mini-check, fine ciclo) | 'migliorato' (rivalutazione annuale).
export function parolaPgic(valore, scala = 'meglio') {
  const opzioni = scala === 'migliorato' ? PGIC_MIGLIORATO : PGIC_MEGLIO;
  const o = opzioni.find(x => x.value === Number(valore));
  return o ? o.label : null;
}
