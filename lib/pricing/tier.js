// ─── Soglie tier CORRENTI — FONTE UNICA JS ───────────────────────────────────
// I numeri 150/500 (Core≤150 · Plus≤500 · Enterprise>500) della soglia CORRENTE vivono
// SOLO qui lato JS. La usano i percorsi clinici/dato via tierFromEmployees(): respond,
// start-cycle, finance, [clientId]. La STESSA soglia vive anche in pricing_settings (v2),
// che l'RPC del neoassunto legge — un test asserisce che le due combacino, così un cambio
// a metà FALLISCE invece di passare in silenzio.
//
// ⚠️ Distinto da lib/pricing/v1.js (CONTRATTO CONGELATO): là le soglie sono il modello
// economico dei clienti a contratto e NON devono cambiare. Qui è la soglia CORRENTE, che
// può evolvere. Sono due mondi volutamente separati — NON agganciare questo a v1.
// NB: bucket SEMPLICE (nessun aggiustamento borderline fatturato/HR — quello è preventivo).
export const TIER_CORE_MAX = 150;
export const TIER_PLUS_MAX = 500;

// Tier di un cliente: usa il tier esplicito se presente, altrimenti il bucket dipendenti.
// Specchia esattamente ciò che facevano gli inline: client.tier || (emp<=150?core:...).
export function tierFromEmployees(employees, explicitTier = null) {
  if (explicitTier) return explicitTier;
  const n = parseInt(employees) || 0;
  return n <= TIER_CORE_MAX ? 'core' : n <= TIER_PLUS_MAX ? 'plus' : 'enterprise';
}
