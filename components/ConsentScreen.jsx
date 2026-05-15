import { useState } from 'react';
import { INFORMATIVA_QUESTIONARIO } from '../lib/legal-texts';

// ─── Modale informativa completa ──────────────────────────────────────────────

function InfoModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '20px 16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', borderRadius: '16px 16px 0 0' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{INFORMATIVA_QUESTIONARIO.titolo}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{INFORMATIVA_QUESTIONARIO.sottotitolo}</div>
          </div>
          <button onClick={onClose} style={{ fontSize: 20, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', maxHeight: '70vh', overflowY: 'auto' }}>
          {INFORMATIVA_QUESTIONARIO.sezioni.map(s => (
            <div key={s.id} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1', marginBottom: 6 }}>{s.titolo}</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line', background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                {s.testo}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{ background: '#0369a1', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
          >
            Ho letto — chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schermata principale ─────────────────────────────────────────────────────

export default function ConsentScreen({ assessmentId, onConsented }) {
  const [cbPrivacy, setCbPrivacy] = useState(false);
  const [cbHealth, setCbHealth] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [saving, setSaving] = useState(false);

  const canProceed = cbPrivacy && cbHealth;

  async function handleStart() {
    if (!canProceed || saving) return;
    setSaving(true);
    try {
      await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: assessmentId,
          consent_privacy: true,
          consent_health: true,
        }),
      });
    } catch (_) {}
    onConsented();
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', width: '100%', padding: '16px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0369a1', letterSpacing: '-0.5px' }}>ES Work</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>by Essentia Salutis</div>
      </div>

      {/* Card */}
      <div style={{ maxWidth: 520, width: '100%', padding: '32px 20px 48px' }}>

        {/* Icona + titolo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
            Prima di iniziare
          </h1>
          <p style={{ fontSize: 15, color: '#475569', margin: 0, lineHeight: 1.6 }}>
            Il questionario raccoglie dati anonimi sul tuo benessere fisico e lavorativo.
            I risultati vengono elaborati solo in forma aggregata — <strong>nessun dato individuale</strong> viene trasmesso al datore di lavoro.
          </p>
        </div>

        {/* Link informativa completa */}
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ fontSize: 13, color: '#0c4a6e' }}>
            📄 Vuoi leggere l'informativa completa sul trattamento dei dati?
          </div>
          <button
            onClick={() => setShowInfo(true)}
            style={{
              background: '#0369a1',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Leggi →
          </button>
        </div>

        {/* Checkbox consensi */}
        <div style={{
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginBottom: 24,
        }}>
          <Checkbox
            checked={cbPrivacy}
            onChange={setCbPrivacy}
            label="Ho letto e compreso l'informativa sul trattamento dei miei dati personali."
          />
          <div style={{ height: 1, background: '#f1f5f9' }} />
          <Checkbox
            checked={cbHealth}
            onChange={setCbHealth}
            label='Presto consenso al trattamento dei miei dati relativi alla salute (art. 9 GDPR) per le finalità indicate.'
          />
        </div>

        {/* Pulsante */}
        <button
          onClick={handleStart}
          disabled={!canProceed || saving}
          style={{
            width: '100%',
            background: canProceed ? '#0369a1' : '#e2e8f0',
            color: canProceed ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: 14,
            padding: '18px',
            fontSize: 17,
            fontWeight: 700,
            cursor: canProceed ? 'pointer' : 'not-allowed',
            transition: 'background .2s, color .2s',
          }}
        >
          {saving ? 'Avvio…' : canProceed ? 'Inizia il questionario →' : 'Spunta entrambe le caselle per procedere'}
        </button>

        <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>
          La partecipazione è anonima e volontaria.
        </p>
      </div>

      {/* Modale informativa */}
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 20, height: 20, marginTop: 2, accentColor: '#0369a1', flexShrink: 0, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 14, color: '#1e3a5f', lineHeight: 1.5, fontWeight: 500 }}>{label}</span>
    </label>
  );
}
