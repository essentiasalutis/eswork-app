// ─────────────────────────────────────────────────────────────────────────────
// Limite di richieste del check-up pubblico (Enrico, 21/9). Fino ad allora non ce
// n'era nessuno: chiunque avesse il link poteva inviare risposte senza fine.
//   · 100 in 10 minuti dallo stesso indirizzo, per azienda — largo: in un'azienda
//     vera un ufficio intero esce dallo stesso indirizzo;
//   · 300 per la demo permanente — ai convegni la sala è su una sola wi-fi.
// Contatori separati per la schermata dei consensi e per l'invio (una persona fa una
// richiesta per ciascuna). Il contatore vive nella memoria del singolo server
// (lib/rate-limit.js): è un argine, non una garanzia globale.
// ─────────────────────────────────────────────────────────────────────────────
import { checkRateLimit, getClientIp } from './rate-limit';

export const LIMITE_CHECKUP = Object.freeze({ azienda: 100, demo: 300, finestraMs: 10 * 60 * 1000 });
export const MESSAGGIO_LIMITE = 'Troppe compilazioni da questa rete negli ultimi minuti: riprova tra qualche minuto.';

export function limiteCheckup(req, { fase, clientId, demo }) {
  const tetto = demo ? LIMITE_CHECKUP.demo : LIMITE_CHECKUP.azienda;
  return checkRateLimit(`checkup:${fase}:${clientId || 'senza-azienda'}:${getClientIp(req)}`, tetto, LIMITE_CHECKUP.finestraMs);
}
