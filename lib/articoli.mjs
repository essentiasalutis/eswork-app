// Articolo davanti a una percentuale, come si legge (modulo PURO): «il 67%», «l'89%»,
// «l'8%», «l'11%», «lo 0%». Prima si scriveva «Il 89% riporta…» nella presentazione
// di Weisoft (27/9). Stessa regola della preposizione articolata (lib/sconto.mjs).
export function vocalePct(v) {
  const n = Math.floor(Math.abs(Number(v)));
  return n === 1 || n === 8 || n === 11 || (n >= 80 && n <= 89);
}

export function ilPct(v, { maiuscola = false } = {}) {
  const n = Math.floor(Math.abs(Number(v)));
  const t = n === 0 ? `lo ${v}%` : vocalePct(v) ? `l'${v}%` : `il ${v}%`;
  return maiuscola ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
