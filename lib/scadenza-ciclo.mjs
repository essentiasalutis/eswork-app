// ─────────────────────────────────────────────────────────────────────────────
// Ciclo di trattamento entro 60 giorni (Enrico, 27/9) — modulo PURO.
// Il ciclo del Livello 1 si completa entro PROTOCOLLO.durata_max_ciclo_giorni dalla presa
// in carico (apertura del ciclo). La piattaforma non blocca: dal giorno
// PROTOCOLLO.avviso_ciclo_giorni, se mancano trattamenti, avvisa l'osteopata.
// Vale solo per i cicli di trattamento aperti; la prevenzione del Livello 2 è nell'anno.
// ─────────────────────────────────────────────────────────────────────────────
import { PROTOCOLLO } from './protocollo.mjs';

const GIORNO = 24 * 60 * 60 * 1000;

export function avvisoDurataCiclo(ciclo, { adesso = new Date() } = {}) {
  if (!ciclo || (ciclo.cycle_type || 'treatment') !== 'treatment' || ciclo.status !== 'active' || !ciclo.started_at) return null;
  const previsti = ciclo.sessions_planned || PROTOCOLLO.sedute_per_ciclo;
  const fatti = ciclo.sessions_completed || 0;
  if (fatti >= previsti) return null;
  const giorni = Math.floor((new Date(adesso) - new Date(ciclo.started_at)) / GIORNO);
  if (giorni < PROTOCOLLO.avviso_ciclo_giorni) return null;
  const limite = PROTOCOLLO.durata_max_ciclo_giorni;
  const restano = limite - giorni;
  // «sedute»: la parola del protocollo e del contratto nell'area dell'osteopata (Enrico, 28/9).
  const base = `Ciclo aperto ${giorni} giorni fa: ${fatti} sedute su ${previsti}.`;
  return {
    giorni, fatti, previsti, restano, superato: restano < 0,
    testo: restano >= 0
      ? `${base} Va completato entro ${limite} giorni dalla presa in carico: ${restano === 0 ? 'oggi è l\'ultimo giorno' : `restano ${restano} ${restano === 1 ? 'giorno' : 'giorni'}`}.`
      : `${base} Il limite di ${limite} giorni dalla presa in carico è superato di ${-restano} ${restano === -1 ? 'giorno' : 'giorni'}.`,
  };
}
