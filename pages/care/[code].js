import { useState } from 'react';
import Head from 'next/head';

const BOOKING_URL = 'https://essentiasalutis.it';
const BOOKING_EMAIL = 'info@essentiasalutis.it';
const WHATSAPP_PHONE = '393271027443'; // +39 327 102 7443

const WA_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function CarePage({ code, clientName, type, expiresAt, valid, discountPct = 10 }) {
  const [name, setName] = useState('');

  function handleWhatsApp(e) {
    e.preventDefault();
    const msg = encodeURIComponent(
      `Buongiorno, vorrei prenotare una visita con la tariffa agevolata ES Work.\nCodice referral: *${code}*\nNome: ${name}`
    );
    // Registra uso in background (fire & forget)
    fetch(`/api/referrals/${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: name }),
    }).catch(() => {});
    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${msg}`, '_blank');
  }

  function handleEmail(e) {
    e.preventDefault();
    const subject = encodeURIComponent(`Prenotazione tariffa agevolata ES Work — codice ${code}`);
    const body = encodeURIComponent(
      `Buongiorno,\n\nVorrei prenotare una visita osteopatica con la tariffa agevolata ES Work.\n\nCodice referral: ${code}\nNome: ${name}\n\nGrazie`
    );
    fetch(`/api/referrals/${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: name }),
    }).catch(() => {});
    window.location.href = `mailto:${BOOKING_EMAIL}?subject=${subject}&body=${body}`;
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
        {/* Logo */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0369a1', letterSpacing: '-0.5px' }}>
            ES Work
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            by Essentia Salutis
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '36px 32px',
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
        }}>
          {!valid ? (
            <>
              <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
              <h1 style={{ fontSize: 20, color: '#0f172a', margin: '0 0 12px' }}>Codice non valido</h1>
              <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
                Il codice non è valido o è scaduto.<br />
                Contatta la tua azienda per riceverne uno nuovo.
              </p>
            </>
          ) : (
            <>
              {/* Badge codice */}
              <div style={{
                display: 'inline-block',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '5px 14px',
                fontSize: 13,
                color: '#1d4ed8',
                fontWeight: 700,
                marginBottom: 18,
                letterSpacing: '0.5px',
              }}>
                {code}
              </div>

              {/* Badge tipo codice */}
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  display: 'inline-block',
                  background: type === 'F' ? '#fdf4ff' : '#f0fdf4',
                  border: `1px solid ${type === 'F' ? '#e9d5ff' : '#bbf7d0'}`,
                  color: type === 'F' ? '#7c3aed' : '#15803d',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                }}>
                  {type === 'F' ? '👨‍👩‍👧 Codice Famigliari' : '👤 Codice Dipendenti'}
                </span>
              </div>

              <h1 style={{ fontSize: 21, color: '#0f172a', margin: '0 0 14px', lineHeight: 1.35 }}>
                {type === 'F'
                  ? 'Accesso riservato a familiari conviventi'
                  : 'Accesso riservato dipendenti ES Work'}
              </h1>

              <p style={{ color: '#475569', fontSize: 14, margin: '0 0 6px', lineHeight: 1.6 }}>
                {type === 'F'
                  ? <>Sei il familiare convivente di un dipendente{clientName ? <> di <strong>{clientName}</strong></> : ''} che partecipa al programma <strong>ES Work</strong>. Hai diritto alla <strong>tariffa agevolata (sconto {discountPct}%)</strong> per le tue sedute osteopatiche.</>
                  : <>{clientName ? <>La tua azienda (<strong>{clientName}</strong>) ti ha </> : 'Hai '}fornito questo codice per accedere alle prestazioni osteopatiche a <strong>tariffa agevolata (sconto {discountPct}%)</strong> tramite il programma <strong>ES Work</strong>.</>
                }
              </p>

              {type === 'F' && (
                <p style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#6d28d9', margin: '0 0 20px' }}>
                  ⚠️ Questo codice è utilizzabile <strong>una sola volta</strong> per intestazione.
                </p>
              )}

              {expiresAt && (
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
                  Valido fino al {new Date(expiresAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}

              {/* Campo nome — obbligatorio */}
              <div style={{ marginBottom: 20, textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Nome e cognome <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="es. Mario Rossi"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 9,
                    fontSize: 15,
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#93c5fd'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Pulsanti — ordine: WA, Email, Sito */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* 1 — WhatsApp */}
                <button
                  onClick={handleWhatsApp}
                  disabled={!name.trim()}
                  style={{
                    width: '100%',
                    background: name.trim() ? '#25d366' : '#d1fae5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '14px',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: name.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                  }}
                >
                  {WA_ICON}
                  Contattaci su WhatsApp
                </button>

                {/* 2 — Email */}
                <button
                  onClick={handleEmail}
                  disabled={!name.trim()}
                  style={{
                    width: '100%',
                    background: '#fff',
                    color: name.trim() ? '#0369a1' : '#94a3b8',
                    border: `1.5px solid ${name.trim() ? '#bae6fd' : '#e2e8f0'}`,
                    borderRadius: 10,
                    padding: '13px',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: name.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  ✉️ Invia una email
                </button>

                {/* Divisore */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>oppure</span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>

                {/* 3 — Sito */}
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    fontSize: 14,
                    color: '#64748b',
                    textDecoration: 'none',
                    padding: '10px',
                  }}
                >
                  🌐 Scopri tutti i servizi su essentiasalutis.it →
                </a>
              </div>

              <p style={{ fontSize: 12, color: '#94a3b8', margin: '20px 0 0' }}>
                Ricorda di indicare il codice <strong style={{ color: '#1d4ed8' }}>{code}</strong> al momento del contatto.
              </p>
            </>
          )}
        </div>

        <div style={{ marginTop: 24, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          © {new Date().getFullYear()} Essentia Salutis — Programma ES Work
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ params }) {
  const code = (params.code || '').toUpperCase();
  // Lettura diretta dal DB (no fetch HTTP a NEXT_PUBLIC_BASE_URL, che su Vercel
  // poteva non risolvere e rendeva la landing sempre "codice non valido").
  const { getReferralCodeByCode } = require('../../lib/store');
  const { CONFIG } = require('../../lib/config');
  const discountPct = CONFIG.referral_discount_pct ?? 10;
  try {
    const referral = await getReferralCodeByCode(code);
    let valid = !!referral;
    if (referral) {
      if (referral.expires_at && new Date(referral.expires_at) < new Date()) valid = false;
      const usesCount = referral.referral_uses?.length || 0;
      if (referral.max_uses !== null && usesCount >= referral.max_uses) valid = false;
    }
    if (!valid) return { props: { code, clientName: '', valid: false, discountPct } };
    return {
      props: {
        code: referral.code,
        clientName: referral.clients?.name || '',
        type: referral.type || 'P',
        expiresAt: referral.expires_at || null,
        valid: true,
        discountPct,
      },
    };
  } catch {
    return { props: { code, clientName: '', valid: false, discountPct } };
  }
}
