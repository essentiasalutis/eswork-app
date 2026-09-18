// Controllo automatico del testo scritto dall'AI, PRIMA di salvarlo.
// Perché esiste (Enrico, 18/9): le regole nel prompt da sole non bastano, l'AI
// ogni tanto le aggira (numeri stimati, paragoni inventati) e non si può validare
// a mano ogni report per scoprirlo. Qui si verifica ciò che è verificabile:
//   1. parole e formule vietate;
//   2. ogni numero del testo deve comparire nei dati forniti all'AI.
// Un testo con problemi si fa riscrivere una volta con l'elenco degli errori; se
// restano, il report si salva marcato «da rivedere».

const VIETATI = [
  [/fisioterap/i, '«fisioterapico»: il servizio è osteopatico'],
  [/riabilita/i, '«riabilitazione»: il servizio è osteopatico'],
  [/(?<!sorveglianza )\bsanitari[oae]?\b/i, '«sanitario» riferito al servizio'],
  [/\bmedicina\b/i, '«medicina» riferito al servizio'],
  [/benchmark/i, 'benchmark non fornito'],
  [/\bstandard\b/i, 'paragone con uno «standard» non fornito'],
  [/in linea con(?! la Stima)/i, 'paragone («in linea con») non fornito'],
  [/(superiore|inferiore) alla media|media di settore|valore di settore/i, 'confronto di settore non fornito'],
  [/\batte[sz][oaie]\b/i, 'valore «atteso» non fornito'],
  [/rischio (basso|medio|alto|elevato)/i, 'scala di rischio inesistente: i livelli non sono rischi'],
  [/\bD\.?\s?M\.?\s|\bdecreto\b|\bart(icolo|\.)\s?\d/i, 'riferimento normativo non fornito'],
  [/stessa coorte/i, 'le coorti sono in parte diverse'],
  [/transitat/i, 'passaggi di singole persone fra livelli non misurati'],
  [/\b\d+\s+su\s+\d+\s+(dipendent|lavorator|person)/i, 'quota di persone ricavata dai punti percentuali'],
  [/\bassessment\b/i, 'lessico: si dice «check-up»'],
  [/anonim/i, 'lessico: i dati sono «riservati», non anonimi'],
  [/\banticip/i, 'tempi diversi da quelli previsti dal programma'],
  [/interventi (osteopatici )?di gruppo|sessioni di gruppo|counseling/i, 'servizio non previsto dal programma'],
];

// Numeri del testo: esclusi quelli attaccati a lettere (T3, L1, OT23, PGIC 4-5 resta).
const RE_NUM = /(?<![A-Za-zÀ-ÿ\d.,])\d+(?:[.,]\d+)?(?![A-Za-zÀ-ÿ\d])/g;
const valore = s => Number(String(s).replace(',', '.'));

// «35.120» e «1.250.000» sono migliaia all'italiana, non decimali.
const migliaia = t => String(t || '').replace(/\b\d{1,3}(?:\.\d{3})+(?!\d|,\d|\.\d)/g, m => m.replace(/\./g, ''));

export function numeriDi(testo) {
  return (migliaia(testo).match(RE_NUM) || []).map(valore).filter(n => Number.isFinite(n));
}

// I numeri piccoli servono agli elenchi e alle scale (1-5 del PGIC, 0-10 del
// dolore, 3/6/12 mesi): non sono dati.
const LIBERI = new Set([...Array(13).keys(), 100]);

export function controllaTesto(testo, { dati = '' } = {}) {
  const problemi = [];
  for (const [re, motivo] of VIETATI) {
    const m = String(testo || '').match(re);
    if (m) problemi.push(`${motivo} — «${m[0]}»`);
  }
  const ammessi = new Set(numeriDi(dati));
  const estranei = [...new Set(numeriDi(testo))].filter(n => !LIBERI.has(n) && !ammessi.has(n));
  for (const n of estranei) problemi.push(`numero non presente nei dati: ${String(n).replace('.', ',')}`);
  return problemi;
}

export function richiestaCorrezione(problemi) {
  return `Il report contiene questi errori:\n${problemi.map(p => `- ${p}`).join('\n')}\n\nRiscrivi l'INTERO report correggendoli: togli le affermazioni sbagliate o usa solo i numeri e i fatti forniti. Non cambiare altro. Rispondi solo con il report.`;
}

// Una generazione con controllo, uguale per tutti i report. `chiedi(messages)`
// restituisce { testo, troncato }. Se il primo testo ha problemi si chiede UNA
// riscrittura con l'elenco; se ne restano, il report è «da rivedere».
export async function generaConControllo(chiedi, prompt) {
  const primo = await chiedi([{ role: 'user', content: prompt }]);
  if (primo.troncato) return { ...primo, problemi: [] };
  let { testo } = primo;
  let problemi = controllaTesto(testo, { dati: prompt });
  if (problemi.length) {
    const secondo = await chiedi([{ role: 'user', content: prompt }, { role: 'assistant', content: testo }, { role: 'user', content: richiestaCorrezione(problemi) }]);
    if (!secondo.troncato) {
      testo = secondo.testo;
      problemi = controllaTesto(testo, { dati: prompt });
    }
  }
  return { testo, troncato: false, problemi, aiStatus: problemi.length ? 'ai_da_rivedere' : 'ai' };
}
