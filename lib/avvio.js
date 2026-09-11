// ─────────────────────────────────────────────────────────────────────────────
// Kit di avvio dopo la firma (punto 12) — modulo PURO. Testo di Enrico (settembre 2026)
// VERBATIM, con le sole modifiche decise da lui:
//   - "potete segnalarlo in qualsiasi momento dalla vostra pagina personale" → "…dalla
//     vostra pagina personale, se l'avete attivata con il check-up" (la pagina ce l'ha
//     solo chi ha chiesto di essere ricontattato, e le segnalazioni sono al massimo 2 l'anno);
//   - firma = "referente — azienda" (il testo lo manda l'azienda ai dipendenti);
//   - frase d'apertura della mail al referente approvata da Enrico;
//   - variante A (micro-azienda, tono diretto): "Ciao a tutti" al posto di "Gentili colleghe
//     e colleghi" (il testo è già al voi plurale, che col saluto informale è il "tu" di gruppo).
// Mail semplice: il grassetto dei titoletti non esiste, restano le parole. Il calendario
// va allegato, non descritto a parole (regola di Enrico).
// ─────────────────────────────────────────────────────────────────────────────
import { isYmd, dalGiorno } from './checkup';
import { bloccoKit } from './riepilogo';

const FIRMA_ENRICO = `Dott. Enrico Maiolo — Essentia Salutis · ES Work
Tel 327 102 7443 · info@essentiasalutis.it`;
const maiuscola = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

export function testoKitAvvio({ variante = 'B', dataAvvio, prenotazione, contatto, firma } = {}) {
  const da = isYmd(dataAvvio) ? maiuscola(dalGiorno(dataAvvio)) : 'Dalla [data di avvio]';
  return {
    oggetto: 'Parte il programma ES Work — ecco come funziona',
    corpo: `${variante === 'A' ? 'Ciao a tutti,' : 'Gentili colleghe e colleghi,'}

l'azienda ha attivato ES Work, un programma dedicato alla salute muscolo-scheletrica. ${da} sarà operativo in sede. Ecco cosa significa concretamente per voi.

Sportello in sede. Un osteopata sarà presente in azienda nelle giornate indicate nel calendario allegato, in uno spazio riservato. Le sessioni durano 30 minuti. Per prenotare: ${(prenotazione || '').trim() || '[come prenotare]'}.

Chi può accedere. Il check-up che avete compilato ha permesso di individuare chi ha più bisogno di una presa in carico e chi invece può beneficiare di sessioni di prevenzione. Sarete contattati direttamente e in forma riservata. Se nel frattempo compaiono dolori o fastidi, potete segnalarlo dalla vostra pagina personale, se l'avete attivata con il check-up.

Formazione per tutti. Sono previste sessioni collettive su postura ed ergonomia, aperte a tutti i colleghi, anche a chi non ha sintomi. Le date sono nel calendario allegato.

Le vostre postazioni. Nel corso del programma verranno osservate le postazioni di lavoro per suggerire adeguamenti pratici.

Riservatezza. Tutto ciò che riguarda la vostra salute resta tra voi e il professionista sanitario. L'azienda non ha accesso a dati individuali: riceve soltanto statistiche complessive, che servono a capire se il programma sta funzionando.

Costi. Il programma è interamente a carico dell'azienda: per voi non c'è nulla da pagare.

Per qualsiasi domanda: ${(contatto || '').trim() || '[contatto del referente]'}.

${firma || ''}`,
  };
}

// Mail al referente con il kit da inoltrare (calendario in allegato).
export function testoMailAvvio({ referente, azienda, kit } = {}) {
  return {
    oggetto: `Avvio del programma ES Work — testo per i dipendenti${azienda ? ` di ${azienda}` : ''}`,
    corpo: `Gentile ${referente || 'referente'},

come concordato, ecco il testo per annunciare ai dipendenti la partenza del programma: va inoltrato con il calendario delle giornate in allegato.

${bloccoKit(kit)}

Resto a disposizione.

${FIRMA_ENRICO}`,
  };
}
