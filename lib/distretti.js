// ─────────────────────────────────────────────────────────────────────────────
// DISTRETTI CORPOREI — la via d'uscita quando la popolazione è piccola.
//
// Il problema (Enrico, 13/9, guardando il report di un'azienda da 13 persone):
// nove zone su tredici risposte fanno gruppi da 1 a 3, e quasi tutto finisce in
// «n.d.». Il report sembra vuoto, e chi lo legge pensa che non ci siano dati.
//
// La risposta NON è togliere la soglia — in un'azienda piccola «1 persona con un
// disturbo alle ginocchia» è un nome, e l'informativa che le persone accettano
// promette «soglie che impediscono l'identificazione». La risposta è chiedere
// MENO DETTAGLIO: raggruppando le nove zone in tre distretti i conteggi si
// sommano e tornano sopra la soglia, senza togliere nulla alla tutela.
//
// Una persona conta UNA volta per distretto anche se ha più zone colpite: il
// distretto risponde a «quante persone hanno un disturbo qui», non a «quanti
// disturbi ci sono». Per questo si calcola dalle risposte, non sommando le zone.
// ─────────────────────────────────────────────────────────────────────────────

// Indici delle zone in BODY_ZONES (lib/scoring.js):
// 0 Collo · 1 Spalle · 2 Schiena alta · 3 Schiena bassa · 4 Gomiti
// 5 Polsi/Mani · 6 Anche/Cosce · 7 Ginocchia · 8 Caviglie/Piedi
export const DISTRETTI = [
  { key: 'rachide', nome: 'Rachide', dettaglio: 'collo, schiena alta e bassa', zone: [0, 2, 3] },
  { key: 'arti_superiori', nome: 'Arti superiori', dettaglio: 'spalle, gomiti, polsi e mani', zone: [1, 4, 5] },
  { key: 'arti_inferiori', nome: 'Arti inferiori', dettaglio: 'anche, ginocchia, caviglie e piedi', zone: [6, 7, 8] },
];

// Quando conviene passare ai distretti: se le zone pubblicabili sono meno della
// metà di quelle in cui qualcuno ha riferito un disturbo. Sotto quella soglia il
// grafico per zona non racconta più niente — è una colonna di «n.d.».
// Le zone a zero non contano: pubblicarle non è un problema, ma non sono nemmeno
// un'informazione che si perde.
export function convieneAggregare(zone = []) {
  const conDisturbo = zone.filter(z => (z.count12 || 0) > 0);
  if (conDisturbo.length < 3) return false;                 // troppe poche per parlarne
  const soppresse = conDisturbo.filter(z => z.soppressa || z.count12 == null);
  return soppresse.length > conDisturbo.length / 2;
}

export const NOTA_DISTRETTI = 'La popolazione è piccola: i disturbi sono raggruppati per distretto corporeo, così i dati restano leggibili senza scendere a gruppi che permetterebbero di riconoscere le persone.';
