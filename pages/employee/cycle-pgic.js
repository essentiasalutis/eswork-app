import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const PGIC_OPTIONS = [
  { value: 5, label: 'Molto meglio', icon: '😄', color: '#16a34a' },
  { value: 4, label: 'Meglio', icon: '🙂', color: '#22c55e' },
  { value: 3, label: 'Invariato', icon: '😐', color: '#ca8a04' },
  { value: 2, label: 'Peggio', icon: '🙁', color: '#ea580c' },
  { value: 1, label: 'Molto peggio', icon: '😢', color: '#dc2626' },
];

function Header() {
  return (
    <div style={{ background: '#1e293b', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, background: '#16a34a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌿</div>
      <div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>ES Work</div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>Valutazione fine ciclo</div>
      </div>
    </div>
  );
}

export default function CyclePgic() {
  const router = useRouter();
  const { token } = router.query;
  const [state, setState] = useState({ loading: true });
  const [pgic, setPgic] = useState(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/employee/cycle-pgic?token=${token}`)
      .then(r => r.json())
      .then(d => setState({ loading: false, ...d }))
      .catch(() => setState({ loading: false, error: true }));
  }, [token]);

  async function submit() {
    if (pgic == null) return;
    setSending(true);
    try {
      const res = await fetch('/api/employee/cycle-pgic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pgic }),
      });
      if (res.ok) setDone(true);
      else { const d = await res.json(); alert(d.error || 'Errore'); }
    } catch { alert('Errore di rete'); }
    setSending(false);
  }

  return (
    <>
      <Head><title>Valutazione fine ciclo — ES Work</title></Head>
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 520, margin: '0 auto' }}>
        <Header />
        <div style={{ padding: '24px 16px' }}>
          {state.loading && <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Caricamento…</div>}

          {!state.loading && (state.error || state.patient == null) && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>Link non valido</div>
            </div>
          )}

          {!state.loading && state.patient && !done && !state.pending && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Tutto a posto</div>
              <div style={{ fontSize: 14, color: '#64748b' }}>Non c'è nessuna valutazione in atteso al momento. Grazie!</div>
            </div>
          )}

          {!state.loading && state.patient && !done && state.pending && (
            <>
              <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Ciao {state.patient.first_name}!</div>
                <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                  Rispetto a <strong>quando hai iniziato</strong> il ciclo di trattamento, come ti senti adesso riguardo al tuo problema?
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PGIC_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setPgic(opt.value)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 14, border: '2px solid', cursor: 'pointer', textAlign: 'left',
                      background: pgic === opt.value ? opt.color : '#fff',
                      borderColor: pgic === opt.value ? opt.color : '#e2e8f0',
                      color: pgic === opt.value ? '#fff' : '#374151' }}>
                    <span style={{ fontSize: 24 }}>{opt.icon}</span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{opt.label}</span>
                  </button>
                ))}
              </div>
              {pgic && (
                <button onClick={submit} disabled={sending}
                  style={{ width: '100%', marginTop: 20, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 14, padding: 18, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
                  {sending ? 'Invio…' : 'Conferma'}
                </button>
              )}
            </>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🙏</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Grazie!</div>
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>La tua valutazione è stata registrata. Il tuo percorso è aggiornato.</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
