import { requireProAuth } from '../../../../lib/pro-auth';
import { updateProfessional } from '../../../../lib/store';
import { hashPassword } from '../../../../lib/pro-auth';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });
  }
  const proId = req.proSession.proId;
  await updateProfessional(proId, {
    password_hash: hashPassword(password),
    must_reset_password: false,
  });
  return res.json({ ok: true });
});
