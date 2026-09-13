// ─────────────────────────────────────────────────────────────────────────────
// «Il programma è attivo?» — FONTE UNICA della domanda, per tutta la piattaforma.
//
// Decisione di Enrico (13/9): chi compila il check-up prima della firma non ha la
// certezza che il programma parta. Fino alla firma nessuno può essere preso in
// carico — e il blocco deve stare sul SERVER, non solo nel nascondere i pulsanti:
// una persona che conosce l'indirizzo dell'API non deve poter far partire una
// notifica all'osteopata per un cliente che non esiste ancora.
//
// Lo stato è quello che c'era già: la pipeline commerciale. «Accettato» (signed) =
// contratto firmato = programma attivo. Non si aggiunge un secondo stato che possa
// discordare dal primo.
//
// Cosa si accende con la firma (e solo con la firma):
//  · l'auto-segnalazione dall'area personale (self-trigger);
//  · gli inviti automatici ai check periodici (mini-check T3, ri-fotografia T6);
//  · la presa in carico dei candidati in coda di pre-validazione.
// Cosa resta acceso comunque: leggere il proprio esito, «Il mio percorso», i diritti
// GDPR. Il check-up è stato compilato: la persona ha diritto di vedere cosa ha detto.
// ─────────────────────────────────────────────────────────────────────────────
import { isFirmato } from './pipeline';

// Unica domanda. Accetta l'azienda intera (come arriva da getClientById).
export function programmaAttivo(client) {
  return !!client && isFirmato(client.pipeline_stage);
}

// Messaggio verso il dipendente: neutro. Non dice «la tua azienda non ha firmato»
// — non è un'informazione che spetta a noi dare, e non è colpa sua.
export const MSG_NON_ATTIVO = 'Il programma della tua azienda non è ancora stato attivato: per ora non è possibile inviare una segnalazione. Appena il programma parte, questa funzione si attiva da sola.';

// Riga mostrata nell'area personale al posto dei pulsanti.
export const RIGA_AREA_NON_ATTIVA = 'Il programma della tua azienda non è ancora partito. Qui trovi l\'esito del tuo check-up; le funzioni del percorso (segnalare un disturbo, i check periodici) si attivano quando il programma viene avviato.';

// Etichetta per l'osteopata sulle voci in coda: dice PERCHÉ sono ferme.
export const ETICHETTA_CODA_NON_ATTIVA = 'Azienda non ancora attiva';
