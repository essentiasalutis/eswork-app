import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

function Header() {
  return (
    <div style={{ background: '#1e293b', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, background: '#16a34a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌿</div>
      <div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>ES Work</div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>Mini-check periodico</div>
      </div>
    </div>
  );
}

// PGIC — Patient Global Impression of Change (scala 1-5, auto-riferito = corretto)
const PGIC_OPTIONS = [
  { value: 5, label: 'Molto meglio', icon: '😄', color: '#16a34a' },
  { value: 4, label: 'Meglio', icon: '🙂', color: '#22c55e' },
  { value: 3, label: 'Invariato', icon: '😐', color: '#ca8a04' },
  { value: 2, label: 'Peggio', icon: '🙁', color: '#ea580c' },
  { value: 1, label: 'Molto peggio', icon: '😢', color: '#dc2626' },
];

export default function MiniCheck() {
  const router = useRouter();
  const { token, type } = router.query;
  const checkType = type || 't3';

  const [step, setStep] = useState(1);
  const [pgic, setPgic] = useState(null);
  const [hasLimitations, setHasLimitations] = useState(null);
  const [wantsContact, setWantsContact] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  async function submit() {
    if (!token) return;
    setSending(true);
    try {
      const res = await fetch('/api/employee/minicheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          pgic,
          has_limitations: hasLimitations,
          wants_contact: wantsContact,
          free_text: freeText || null,
          check_type: checkType,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: 'Errore di rete' });
    }
    setSending(false);
  }

  if (result) {
    const needsContact = result.triage_outcome === 'needs_contact';
    return (
      <>
        <Head><title>Mini-check {checkType.toUpperCase()} — ES Work</title></Head>
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 520, margin: '0 auto' }}>
          <Header />
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>{needsContact ? '🔔' : '✅'}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Grazie!</div>
            {needsContact ? (
              <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, background: '#fef9c3', border: '1px solid #fde047', borderRadius: 14, padding: '16px 20px' }}>
                La tua segnalazione indica che potresti necessitare di una valutazione clinica.<br />
                <strong>Sarai contattato entro 5 giorni lavorativi</strong> per programmare una videocall con un osteopata del nostro team.
              </div>
            ) : (
              <div style={{ fontSize: 15, color: '#374151', lineHeight: 1.7 }}>
                Le tue risposte sono state registrate. Il tuo programma di prevenzione prosegue regolarmente.
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const months = checkType === 't3' ? '3' : '6';

  return (
    <>
      <Head><title>Mini-check {checkType.toUpperCase()} — ES Work</title></Head>
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 520, margin: '0 auto' }}>
        <Header />

        <div style={{ padding: '24px 16px' }}>
          {/* Intro */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
              Mini-check {checkType.toUpperCase()} — {months} mesi
            </div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
              Siamo a circa {months} mesi dall&apos;inizio del tuo programma. Rispondi a 3 domande veloci per aggiornarci sul tuo stato di salute.
            </div>
          </div>

          {/* Step 1: PGIC — cambiamento percepito */}
          {step >= 1 && (
            <div style={{ background: '#fff', borderRadius: 16, border: `2px solid ${step === 1 ? '#0369a1' : '#e2e8f0'}`, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                1. Rispetto all&apos;inizio del programma, come ti senti?
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Pensa al tuo benessere muscolo-scheletrico complessivo.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PGIC_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setPgic(opt.value); if (step === 1) setStep(2); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '2px solid', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
                      background: pgic === opt.value ? opt.color : '#fff',
                      borderColor: pgic === opt.value ? opt.color : '#e2e8f0',
                      color: pgic === opt.value ? '#fff' : '#374151' }}>
                    <span style={{ fontSize: 22 }}>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Limitazioni */}
          {step >= 2 && (
            <div style={{ background: '#fff', borderRadius: 16, border: `2px solid ${step === 2 ? '#0369a1' : '#e2e8f0'}`, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                2. Il dolore o fastidio limita le tue attività quotidiane o lavorative?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ val: false, label: '😊 No', color: '#16a34a' }, { val: true, label: '😟 Sì', color: '#dc2626' }].map(({ val, label, color }) => (
                  <button key={String(val)} onClick={() => { setHasLimitations(val); if (step === 2) setStep(3); }}
                    style={{ flex: 1, padding: '14px', borderRadius: 12, border: '2px solid', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                      background: hasLimitations === val ? color : '#fff',
                      borderColor: hasLimitations === val ? color : '#e2e8f0',
                      color: hasLimitations === val ? '#fff' : '#374151' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Vuole contatto */}
          {step >= 3 && (
            <div style={{ background: '#fff', borderRadius: 16, border: `2px solid ${step === 3 ? '#0369a1' : '#e2e8f0'}`, padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                3. Vuoi essere ricontattato da un osteopata del nostro team?
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ val: true, label: '📞 Sì, voglio un contatto', color: '#0369a1' }, { val: false, label: '✓ No grazie', color: '#16a34a' }].map(({ val, label, color }) => (
                  <button key={String(val)} onClick={() => setWantsContact(val)}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: '2px solid', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                      background: wantsContact === val ? color : '#fff',
                      borderColor: wantsContact === val ? color : '#e2e8f0',
                      color: wantsContact === val ? '#fff' : '#374151' }}>
                    {label}
                  </button>
                ))}
              </div>
              {wantsContact !== null && (
                <textarea
                  value={freeText}
                  onChange={e => setFreeText(e.target.value.slice(0, 300))}
                  placeholder="Aggiungi una nota (facoltativo)..."
                  rows={2}
                  style={{ width: '100%', marginTop: 12, borderRadius: 10, border: '1.5px solid #e2e8f0', padding: '10px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              )}
            </div>
          )}

          {/* Submit */}
          {step >= 3 && wantsContact !== null && (
            <button onClick={submit} disabled={sending}
              style={{ width: '100%', background: sending ? '#e2e8f0' : '#0369a1', color: sending ? '#94a3b8' : '#fff',
                border: 'none', borderRadius: 14, padding: '18px', fontSize: 17, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}>
              {sending ? 'Invio...' : 'Invia mini-check →'}
            </button>
          )}

          <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>
            🔒 Risposte riservate · Non visibili al datore di lavoro
          </p>
        </div>
      </div>
    </>
  );
}
