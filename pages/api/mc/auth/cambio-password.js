// POST /api/mc/auth/cambio-password — obbligatorio al primo accesso.
import { hashPassword } from '../../../../lib/pro-auth';
import { requireMcAuth } from '../../../../lib/mc-auth';
import { aggiornaMedico, registra } from '../../../../lib/medico-competente-server';

export default requireMcAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body || {};
  if (!password || String(password).length < 10) return res.status(400).json({ error: 'La password deve avere almeno 10 caratteri.' });
  await aggiornaMedico(req.medico.id, { password_hash: hashPassword(String(password)), must_reset_password: false });
  await registra({ medicoId: req.medico.id, azione: 'cambio_password', ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
  return res.json({ ok: true });
}, { consentiCambioPassword: true });
