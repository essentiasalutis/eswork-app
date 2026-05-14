import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function CarePage({ code, clientName, valid, error }) {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);

  async function handlePrenotazione(e) {
    e.preventDefault();
    if (!valid || submitted) return;
    setSending(true);
    try {
      await fetch(`/api/referrals/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_name: name }),
      });
      setSubmitted(true);
    } catch (_) {}
    setSending(false);
  }

  return (
    <>
      <Head>
        <title>ES Work — Tariffa Agevolata</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Logo / Brand */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#0369a1',
            letterSpacing: '-0.5px',
          }}>
            ES Work
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            by Essentia Salutis
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '40px 36px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
        }}>
          {!valid ? (
            /* Codice non valido */
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
              <h1 style={{ fontSize: 20, color: '#0f172a', margin: '0 0 12px' }}>
                Codice non valido
              </h1>
              <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
                Il codice che hai inserito non è valido o è scaduto.<br />
                Contatta la tua azienda per ricevere un nuovo codice.
              </p>
            </>
          ) : submitted ? (
            /* Conferma invio */
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <h1 style={{ fontSize: 20, color: '#0f172a', margin: '0 0 12px' }}>
                Ottimo! Accesso registrato.
              </h1>
              <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
                Ricorda di indicare il codice <strong style={{ color: '#0369a1' }}>{code}</strong>{' '}
                quando prenoti la tua visita su{' '}
                <a
                  href="https://essentiasalutis.it"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0369a1' }}
                >
                  essentiasalutis.it
                </a>.
              </p>
            </>
          ) : (
            /* Form principale */
            <>
              <div style={{
                display: 'inline-block',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13,
                color: '#1d4ed8',
                fontWeight: 600,
                marginBottom: 20,
              }}>
                Codice: {code}
              </div>

              <h1 style={{ fontSize: 22, color: '#0f172a', margin: '0 0 16px', lineHeight: 1.3 }}>
                Hai diritto alla tariffa agevolata ES Work
              </h1>

              <p style={{ color: '#475569', fontSize: 15, margin: '0 0 8px', lineHeight: 1.6 }}>
                La tua azienda{clientName ? <> (<strong>{clientName}</strong>)</> : ''} ti ha fornito
                questo codice per accedere alle prestazioni osteopatiche a tariffa agevolata del
                programma <strong>ES Work</strong>.
              </p>
              <p style={{ color: '#475569', fontSize: 15, margin: '0 0 28px', lineHeight: 1.6 }}>
                Prenota su <strong>essentiasalutis.it</strong> e indica il codice{' '}
                <strong style={{ color: '#0369a1' }}>{code}</strong> al momento della prenotazione.
              </p>

              <form onSubmit={handlePrenotazione}>
                <div style={{ marginBottom: 20, textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                    Il tuo nome (facoltativo)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="es. Mario Rossi"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 15,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    Facoltativo — aiuta il tuo datore di lavoro a monitorare l'utilizzo del programma.
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    width: '100%',
                    background: '#0369a1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '14px',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginBottom: 12,
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? 'Registrazione...' : '📅 Prenota ora'}
                </button>

                <a
                  href="https://essentiasalutis.it"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    color: '#64748b',
                    textDecoration: 'none',
                  }}
                >
                  Vai su essentiasalutis.it →
                </a>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          © {new Date().getFullYear()} Essentia Salutis — Programma ES Work
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ params }) {
  const code = (params.code || '').toUpperCase();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/referrals/${code}`);
    if (!res.ok) {
      return { props: { code, clientName: '', valid: false } };
    }
    const data = await res.json();
    return { props: { code: data.code, clientName: data.clientName, valid: true } };
  } catch (e) {
    return { props: { code, clientName: '', valid: false } };
  }
}
