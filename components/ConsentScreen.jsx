import { useState } from 'react';
import { INFORMATIVA_QUESTIONARIO } from '../lib/legal-texts';

export default function ConsentScreen({ assessmentId, onConsented }) {
  const [cbPrivacy, setCbPrivacy] = useState(false);
  const [cbHealth, setCbHealth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canProceed = cbPrivacy && cbHealth;

  async function handleStart() {
    if (!canProceed || saving) return;
    setSaving(true);
    setError(null);
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
    } catch (_) {
      // Non blocchiamo il flusso se la chiamata fallisce — il consenso UI è già stato espresso
    }
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
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        width: '100%',
        padding: '16px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0369a1', letterSpacing: '-0.5px' }}>
          ES Work
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>by Essentia Salutis</div>
      </div>

      {/* Card */}
      <div style={{
        maxWidth: 680,
        width: '100%',
        padding: '24px 20px 40px',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4, marginTop: 24 }}>
          Prima di iniziare
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
          {INFORMATIVA_QUESTIONARIO.sottotitolo}
        </p>

        {/* Sezioni informativa */}
        {INFORMATIVA_QUESTIONARIO.sezioni.map(s => (
          <div key={s.id} style={{ marginBottom: 20 }}>
            <div style={{
              fontWeight: 700,
              fontSize: 14,
              color: '#0369a1',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#0369a1',
              }} />
              {s.titolo}
            </div>
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '14px 16px',
              fontSize: 13,
              color: '#374151',
              lineHeight: 1.7,
              whiteSpace: 'pre-line',
            }}>
              {s.testo}
            </div>
          </div>
        ))}

        {/* Checkbox consensi */}
        <div style={{
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: 12,
          padding: '20px 20px',
          marginTop: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <Checkbox
            checked={cbPrivacy}
            onChange={setCbPrivacy}
            label="Ho letto e compreso l'informativa sul trattamento dei miei dati personali."
          />
          <Checkbox
            checked={cbHealth}
            onChange={setCbHealth}
            label="Presto consenso al trattamento dei miei dati relativi alla salute (art. 9 GDPR) per le finalità indicate nell'informativa."
          />
        </div>

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</div>
        )}

        {/* Pulsante */}
        <button
          onClick={handleStart}
          disabled={!canProceed || saving}
          style={{
            width: '100%',
            marginTop: 24,
            background: canProceed ? '#0369a1' : '#e2e8f0',
            color: canProceed ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: 12,
            padding: '16px',
            fontSize: 16,
            fontWeight: 700,
            cursor: canProceed ? 'pointer' : 'not-allowed',
            transition: 'background .2s',
          }}
        >
          {saving ? 'Avvio…' : 'Inizia il questionario →'}
        </button>

        <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>
          I tuoi dati sono protetti e non vengono mai trasmessi al datore di lavoro in forma individuale.
        </p>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      cursor: 'pointer',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{
          width: 20,
          height: 20,
          marginTop: 2,
          accentColor: '#0369a1',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      />
      <span style={{ fontSize: 14, color: '#1e3a5f', lineHeight: 1.5, fontWeight: 500 }}>
        {label}
      </span>
    </label>
  );
}
