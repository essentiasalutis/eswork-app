import { requireProAuth, hashPassword, setProSessionCookie } from '../../../../lib/pro-auth';
import { updateProfessional } from '../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri' });
  }

  const { proId, proName, proEmail } = req.proSession;

  await updateProfessional(proId, {
    password_hash: hashPassword(password),
    must_reset_password: false,
  });

  // Aggiorna il cookie di sessione con mustReset: false
  setProSessionCookie(res, {
    role: 'professional',
    proId,
    proName,
    proEmail,
    mustReset: false,
  });

  return res.json({ ok: true });
});
