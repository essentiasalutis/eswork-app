// ─────────────────────────────────────────────────────────────────────────────
// Piano di intervento dell'Offerta. Modulo PURO, usato in due punti:
//   - lato server (props della pagina): la tabella c'è sempre, calcolata qui, e
//     NESSUN dato esce dalla piattaforma;
//   - dentro /api/ai/intervention-plan: stesso piano come testo di riserva, più
//     la whitelist del payload che può uscire verso l'AI.
// Privacy (decisione Enrico, 12/9): il trasferimento verso gli Stati Uniti deve
// essere un gesto intenzionale, non la conseguenza di aver aperto una pagina.
// ─────────────────────────────────────────────────────────────────────────────
import { BODY_ZONES } from './scoring';

const INTERVENTI = {
  'Collo': 'Sportello osteopatico — protocollo cervicale + ergonomia postazione',
  'Spalle': 'Sportello osteopatico — protocollo spalle + formazione postura',
  'Schiena alta (dorsale)': 'Sportello osteopatico — rachide dorsale + ergonomia workstation',
  'Schiena bassa (lombare)': 'Sportello osteopatico — lombare + formazione movimentazione carichi',
  'Gomiti': 'Sportello osteopatico — arto superiore + analisi postura lavoro',
  'Polsi / Mani': 'Sportello osteopatico — polso/mano + ergonomia strumenti lavoro',
  'Anche / Cosce': 'Sportello osteopatico — arto inferiore + formazione stazione eretta',
  'Ginocchia': 'Sportello osteopatico — protocollo ginocchio + analisi del passo',
  'Caviglie / Piedi': 'Sportello osteopatico — arto inferiore distale + calzature professionali',
};

export const SOGLIA_ZONA = 30;

// Zone da portare nel piano: quelle sopra soglia, o le due più alte se nessuna lo è.
export function zoneCritiche(zones = []) {
  const valide = (Array.isArray(zones) ? zones : []).filter(z => z && Number.isFinite(Number(z.pct12)));
  const sopra = valide.filter(z => Number(z.pct12) >= SOGLIA_ZONA).sort((a, b) => b.pct12 - a.pct12);
  const scelte = sopra.length ? sopra : [...valide].sort((a, b) => b.pct12 - a.pct12).slice(0, 2);
  return scelte.slice(0, 5);
}

// Piano della piattaforma: stessa tabella di sempre, senza AI.
export function pianoDeterministico(zones = []) {
  return zoneCritiche(zones).map(z => ({
    criticita: `${z.pct12}% disturbi ${String(z.zone).toLowerCase()}`,
    intervento: INTERVENTI[z.zone] || 'Sportello osteopatico + formazione mirata',
    risultato: 'Riduzione sintomi 20-30% in 12 mesi',
  }));
}

// Whitelist di ciò che può uscire verso l'AI: SOLO zona nota e percentuale intera.
// Il server non inoltra il corpo della richiesta: lo ricostruisce da qui (niente
// pass-through). Il nome dell'azienda non esce più (minimizzazione, 12/9).
export function zoneAmmesse(zones) {
  if (!Array.isArray(zones)) return [];
  const viste = new Set();
  const out = [];
  for (const z of zones) {
    const zona = typeof z?.zone === 'string' ? z.zone.trim() : '';
    if (!BODY_ZONES.includes(zona) || viste.has(zona)) continue;
    const pct = Math.round(Number(z?.pct12));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) continue;
    viste.add(zona);
    out.push({ zone: zona, pct12: pct });
  }
  return out.slice(0, BODY_ZONES.length);
}
