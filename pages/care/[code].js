import { useState } from 'react';
import Head from 'next/head';

const BOOKING_URL = 'https://essentiasalutis.it';
const BOOKING_EMAIL = 'info@essentiasalutis.it';
const WHATSAPP_PHONE = '393271027443'; // +39 327 102 7443

export default function CarePage({ code, clientName, valid }) {
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);

  async function handlePrenotazione(e) {
    e.preventDefault();
    if (!valid) return;
    setSending(true);
    try {
      // Registra l'utilizzo in background
      await fetch(`/api/referrals/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_name: name }),
      });
    } catch (_) {}
    // Reindirizza al sito di prenotazione
    window.location.href = BOOKING_URL;
  }

  function handleEmail() {
    const subject = encodeURIComponent(`Prenotazione tariffa agevolata ES Work — codice ${code}`);
    const body = encodeURIComponent(`Buongiorno,\n\nVorrei prenotare una visita osteopatica con la tariffa agevolata ES Work.\n\nCodice referral: ${code}${name ? `\nNome: ${name}` : ''}\n\nGrazie`);
    window.location.href = `mailto:${BOOKING_EMAIL}?subject=${subject}&body=${body}`;
  }

  function handleWhatsApp() {
    const msg = encodeURIComponent(`Buongiorno, vorrei prenotare una visita con la tariffa agevolata ES Work.\nCodice referral: *${code}*${name ? `\nNome: ${name}` : ''}`);
    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${msg}`, '_blank');
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

                {/* Pulsante principale → va al sito */}
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
                    marginBottom: 10,
                    opacity: sending ? 0.7 : 1,
                  }}
                >
                  {sending ? 'Un momento…' : '🌐 Prenota sul sito'}
                </button>

                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  style={{
                    width: '100%',
                    background: '#25d366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '13px',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Scrivi su WhatsApp
                </button>

                {/* Email */}
                <button
                  type="button"
                  onClick={handleEmail}
                  style={{
                    width: '100%',
                    background: '#fff',
                    color: '#0369a1',
                    border: '1.5px solid #bae6fd',
                    borderRadius: 10,
                    padding: '13px',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: 16,
                  }}
                >
                  ✉️ Prenota via email
                </button>

                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                  Indica sempre il codice <strong>{code}</strong> al momento della prenotazione.
                </p>
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
