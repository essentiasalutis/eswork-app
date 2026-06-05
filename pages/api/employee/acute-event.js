// DEPRECATO — il canale "evento acuto" è stato consolidato nel self-trigger (BLOCCO C).
// La UI dipendente non chiama più questo endpoint. Mantenuto solo per non rompere
// eventuali link esterni: risponde 410 e rimanda al nuovo flusso.
export default function handler(req, res) {
  return res.status(410).json({
    error: 'Canale evento acuto dismesso. Usa il self-trigger (auto-segnalazione) dalla tua area: una segnalazione urgente viene gestita con priorità.',
    use: '/api/employee/self-trigger',
  });
}
