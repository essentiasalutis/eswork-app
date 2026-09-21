// Sessione dell'amministratore (21/9): solo l'email di amministrazione, nessun altro
// ruolo. Prima qualunque sessione firmata (anche di un osteopata) apriva tutto.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_EMAIL = 'admin@esempio.it';
process.env.SESSION_SECRET = 'segreto-di-prova';
const { signToken, verifyAdminToken, sessioneAdmin } = await import('../lib/auth.js');

const exp = Date.now() + 60000;

test('la sessione di un osteopata non è una sessione da amministratore', () => {
  const t = signToken({ role: 'professional', proId: 'pro_1', proName: 'X', proEmail: 'admin@esempio.it', exp });
  assert.equal(verifyAdminToken(t), null);
});

test('email di amministrazione con un altro ruolo: rifiutata', () => {
  assert.equal(verifyAdminToken(signToken({ email: 'admin@esempio.it', role: 'medico_competente', exp })), null);
  assert.equal(verifyAdminToken(signToken({ email: 'admin@esempio.it', role: 'professional', exp })), null);
});

test('amministratore: nuova sessione e sessione emessa prima del 21/9', () => {
  assert.ok(verifyAdminToken(signToken({ email: 'admin@esempio.it', role: 'admin', exp })));
  assert.ok(verifyAdminToken(signToken({ email: 'admin@esempio.it', exp })));
});

test('altra email, firma sbagliata, scaduta: rifiutate', () => {
  assert.equal(verifyAdminToken(signToken({ email: 'altro@esempio.it', role: 'admin', exp })), null);
  const t = signToken({ email: 'admin@esempio.it', role: 'admin', exp });
  assert.equal(verifyAdminToken(t.slice(0, -2) + 'xx'), null);
  assert.equal(verifyAdminToken(signToken({ email: 'admin@esempio.it', role: 'admin', exp: Date.now() - 1 })), null);
  assert.equal(sessioneAdmin(null), false);
});
