// Stato della polizza RC del professionista — usato sia lato osteopata
// (/pro/documents) sia lato admin (conformità, elenco professionisti).
// Distinzione GIURIDICA (Art. 7.2 del contratto):
//   missing/expired → NESSUNA copertura valida → operatività sospesa (rosso)
//   expiring (≤30gg) → copertura ANCORA valida → solo promemoria (ambra)
//   no_expiry → presente ma senza scadenza nota → da completare
//   valid → copertura valida
export function rcStatusFrom(rcDoc, { warnDays = 30 } = {}) {
  if (!rcDoc) return { status: 'missing', days: null };
  if (!rcDoc.expiry_date) return { status: 'no_expiry', days: null };
  const now = Date.now();
  const e = Date.parse(rcDoc.expiry_date);
  const days = Math.ceil((e - now) / 86400000);
  const status = e < now ? 'expired' : days <= warnDays ? 'expiring' : 'valid';
  return { status, days };
}

// true = nessuna copertura valida (sospensione Art. 7.2). NON blocca nulla a
// livello tecnico: è la base per l'avviso visivo e la raccomandazione "non assegnare".
export function isRcSuspended(status) {
  return status === 'expired' || status === 'missing';
}
