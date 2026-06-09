import { useState } from 'react';
import Head from 'next/head';

export default function ConfermaPage({ voucher, clientName, valid, alreadyConfirmed, prevResponse }) {
  const [done, setDone] = useState(alreadyConfirmed ? prevResponse : null);
  const [busy, setBusy] = useState(false);

  async function confirm(response) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/referrals/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_code: voucher, response }),
      });
      if (r.ok) setDone(response);
      else alert('Errore. Riprova.');
    } catch { alert('Errore di rete.'); }
    setBusy(false);
  }

  const wrap = {
    minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
  const card = { background: '#fff', borderRadius: 18, padding: 28, maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.08)' };

  return (
    <>
      <Head><title>ES Work — Conferma visita</title><meta name="robots" content="noindex" /><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontWeight: 900, color: '#1e293b', fontSize: 18, marginBottom: 2 }}>ES <span style={{ color: '#16a34a' }}>Work</span></div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 18 }}>by Essentia Salutis</div>

          {!valid ? (
            <>
              <div style={{ fontSize: 40 }}>❌</div>
              <h1 style={{ fontSize: 18, color: '#0f172a' }}>Buono non valido</h1>
              <p style={{ color: '#64748b', fontSize: 14 }}>Controlla il link ricevuto.</p>
            </>
          ) : done ? (
            <>
              <div style={{ fontSize: 40 }}>{done === 'done' ? '✅' : '👍'}</div>
              <h1 style={{ fontSize: 18, color: '#0f172a' }}>Grazie!</h1>
              <p style={{ color: '#64748b', fontSize: 14 }}>
                {done === 'done' ? 'Abbiamo registrato la tua conferma.' : 'Grazie, abbiamo annotato che non hai ancora svolto la visita.'}
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 19, color: '#0f172a', margin: '0 0 8px' }}>Hai fatto la visita?</h1>
              <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
                Visita osteopatica con la tariffa agevolata ES Work{clientName ? <> (programma di <strong>{clientName}</strong>)</> : ''}. Buono <strong>{voucher}</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => confirm('done')} disabled={busy}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                  ✅ Sì, ho fatto la visita
                </button>
                <button onClick={() => confirm('not_done')} disabled={busy}
                  style={{ background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  Non ancora
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ query }) {
  const voucher = (query.v || '').toString().trim().toUpperCase();
  if (!voucher) return { props: { voucher: '', valid: false } };
  try {
    const { getReferralUseByVoucher } = require('../../lib/store');
    const use = await getReferralUseByVoucher(voucher);
    if (!use) return { props: { voucher, valid: false } };
    return {
      props: {
        voucher,
        valid: true,
        clientName: use.referral_codes?.clients?.name || '',
        alreadyConfirmed: !!use.confirm_response,
        prevResponse: use.confirm_response || null,
      },
    };
  } catch {
    return { props: { voucher, valid: false } };
  }
}
