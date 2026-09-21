// Firma delle sessioni con una chiave per ruolo (21/9): lo scambio fra ruoli è
// impossibile per costruzione, non vietato da un controllo.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.ADMIN_EMAIL = 'admin@esempio.it';
process.env.SESSION_SECRET = 'segreto-di-prova-abbastanza-lungo';
const { firma, verifica, RUOLI } = await import('../lib/firma-sessione.js');
const { verifyAdminToken, signAdminToken } = await import('../lib/auth.js');

const exp = () => Date.now() + 60000;

test('una sessione firmata per un ruolo non vale per nessun altro (tutte le combinazioni)', () => {
  for (const da of RUOLI) {
    const t = firma(da, { email: 'admin@esempio.it', exp: exp() });
    for (const a of RUOLI) {
      if (a === da) assert.ok(verifica(a, t), `${da} verso sé stesso`);
      else assert.equal(verifica(a, t), null, `${da} usata come ${a}`);
    }
  }
});

test('le chiavi sono derivate con HMAC, non concatenate', () => {
  // La firma attesa si ricostruisce solo con chiave = HMAC(segreto, etichetta+ruolo).
  const dati = Buffer.from(JSON.stringify({ role: 'admin', email: 'a', exp: exp() })).toString('base64url');
  const k = crypto.createHmac('sha256', process.env.SESSION_SECRET).update('eswork-sessione-v1:admin').digest();
  const buona = `${dati}.${crypto.createHmac('sha256', k).update(dati).digest('base64url')}`;
  assert.ok(verifica('admin', buona));
  const concatenata = `${dati}.${crypto.createHmac('sha256', process.env.SESSION_SECRET + 'admin').update(dati).digest('base64url')}`;
  assert.equal(verifica('admin', concatenata), null);
});

test('le sessioni del formato vecchio (segreto usato direttamente) non valgono più', () => {
  const dati = Buffer.from(JSON.stringify({ email: 'admin@esempio.it', role: 'admin', exp: exp() })).toString('base64url');
  const vecchia = `${dati}.${crypto.createHmac('sha256', process.env.SESSION_SECRET).update(dati).digest('base64url')}`;
  assert.equal(verifica('admin', vecchia), null);
  assert.equal(verifyAdminToken(vecchia), null);
});

test('il ruolo scritto nei dati non si può forzare', () => {
  const t = firma('professional', { role: 'admin', email: 'admin@esempio.it', exp: exp() });
  assert.equal(verifica('professional', t).role, 'professional');
  assert.equal(verifyAdminToken(t), null);
});

test('amministratore: email di amministrazione obbligatoria', () => {
  assert.ok(verifyAdminToken(signAdminToken({ email: 'admin@esempio.it', exp: exp() })));
  assert.equal(verifyAdminToken(signAdminToken({ email: 'altro@esempio.it', exp: exp() })), null);
});

test('firma alterata, formato sbagliato, senza scadenza o scaduta: rifiutate', () => {
  const t = firma('admin', { email: 'admin@esempio.it', exp: exp() });
  assert.equal(verifica('admin', t.slice(0, -3) + 'abc'), null);
  assert.equal(verifica('admin', t + '.x'), null);
  assert.equal(verifica('admin', 'nonunasessione'), null);
  assert.equal(verifica('admin', firma('admin', { email: 'admin@esempio.it' })), null);
  assert.equal(verifica('admin', firma('admin', { email: 'admin@esempio.it', exp: Date.now() - 1 })), null);
  assert.equal(verifica('ruolo_inventato', t), null);
});

test('in produzione senza segreto non si firma e non si verifica', () => {
  const t = firma('admin', { email: 'admin@esempio.it', exp: exp() });
  const segreto = process.env.SESSION_SECRET, ambiente = process.env.NODE_ENV;
  try {
    delete process.env.SESSION_SECRET; process.env.NODE_ENV = 'production';
    assert.throws(() => firma('admin', { exp: exp() }), /SESSION_SECRET mancante/);
    assert.equal(verifica('admin', t), null);
  } finally {
    process.env.SESSION_SECRET = segreto; process.env.NODE_ENV = ambiente;
  }
});
