import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const NMQ_ZONES = [
  { key: 'collo', label: 'Collo', icon: '🔝' },
  { key: 'spalle', label: 'Spalle', icon: '💪' },
  { key: 'braccia', label: 'Braccia / Gomiti', icon: '🦾' },
  { key: 'polsi', label: 'Polsi / Mani', icon: '🤲' },
  { key: 'schiena_alta', label: 'Schiena alta (dorsale)', icon: '🔙' },
  { key: 'schiena_bassa', label: 'Schiena bassa (lombare)', icon: '🪑' },
  { key: 'anche', label: 'Anche / Glutei', icon: '🦋' },
  { key: 'ginocchia', label: 'Ginocchia', icon: '🦵' },
  { key: 'caviglie', label: 'Caviglie / Piedi', icon: '🦶' },
];

const PGIC_OPTIONS = [
  { value: 5, label: 'Molto migliorato', icon: '😄', color: '#16a34a' },
  { value: 4, label: 'Migliorato', icon: '🙂', color: '#22c55e' },
  { value: 3, label: 'Invariato', icon: '😐', color: '#ca8a04' },
  { value: 2, label: 'Peggiorato', icon: '🙁', color: '#ea580c' },
  { value: 1, label: 'Molto peggiorato', icon: '😢', color: '#dc2626' },
];

function Header() {
  return (
    <div style={{ background: '#1e293b', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, background: '#16a34a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌿</div>
      <div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>ES Work</div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>Re-assessment 12 mesi</div>
      </div>
    </div>
  );
}

export default function ReassessmentT12() {
  const router = useRouter();
  const { token } = router.query;

  const [phase, setPhase] = useState('nmq'); // nmq | pgic | done
  const [zoneIndex, setZoneIndex] = useState(0);
  const [nmqData, setNmqData] = useState({});
  const [pgic, setPgic] = useState(null);
  const [sending, setSending] = useState(false);

  const currentZone = NMQ_ZONES[zoneIndex];

  // Stessa gerarchia del questionario iniziale: 7 giorni → 12 mesi → impatto,
  // con coerenza automatica (7gg=Sì ⇒ 12m auto-Sì; nessun dolore ⇒ impatto auto-No).
  function setPain7(key, val) {
    setNmqData(prev => {
      const z = { ...(prev[key] || {}) };
      z.pain_7days = val;
      if (val) { z.pain_12m = true; delete z.functional_impact; }
      else { delete z.pain_12m; delete z.functional_impact; }
      return { ...prev, [key]: z };
    });
  }
  function setPain12(key, val) {
    setNmqData(prev => {
      const z = { ...(prev[key] || {}) };
      if (z.pain_7days === true) return prev; // bloccata: auto-Sì
      z.pain_12m = val;
      if (val === false) z.functional_impact = false; // nessun dolore ⇒ nessun impatto
      else delete z.functional_impact;
      return { ...prev, [key]: z };
    });
  }
  function setImpact(key, val) {
    setNmqData(prev => {
      const z = { ...(prev[key] || {}) };
      if (z.pain_7days == null || (z.pain_7days === false && z.pain_12m !== true)) return prev;
      z.functional_impact = val;
      return { ...prev, [key]: z };
    });
  }

  function nextZone() {
    if (zoneIndex < NMQ_ZONES.length - 1) setZoneIndex(i => i + 1);
    else setPhase('pgic');
  }

  async function submit() {
    if (!token || pgic == null) return;
    setSending(true);
    try {
      await fetch('/api/employee/reassessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nmq_data: nmqData, pgic }),
      });
    } catch {}
    setSending(false);
    setPhase('done');
  }

  const zoneData = nmqData[currentZone?.key] || {};
  const progress = Math.round(((zoneIndex + (phase === 'pgic' ? 1 : 0)) / NMQ_ZONES.length) * 100);

  return (
    <>
      <Head><title>Re-assessment 12 mesi — ES Work</title></Head>
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 520, margin: '0 auto' }}>
        <Header />

        {phase === 'done' ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Re-assessment completato!</div>
            <div style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7 }}>
              Grazie per aver completato il tuo re-assessment annuale. I risultati saranno elaborati dal nostro team e ti verrà comunicato l&apos;aggiornamento del tuo percorso.
            </div>
          </div>
        ) : phase === 'pgic' ? (
          <div style={{ padding: '24px 16px' }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '20px', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Valutazione globale</div>
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                Dall&apos;inizio del programma (circa 12 mesi fa), come ti senti complessivamente riguardo al tuo apparato muscolo-scheletrico?
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PGIC_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setPgic(opt.value)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 14, border: '2px solid', cursor: 'pointer', transition: 'all .15s', textAlign: 'left',
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
                style={{ width: '100%', marginTop: 20, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 14, padding: '18px', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
                {sending ? 'Invio...' : 'Completa re-assessment →'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px 16px' }}>
            {/* Progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                <span>Zona {zoneIndex + 1} di {NMQ_ZONES.length}</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                <div style={{ height: '100%', background: '#16a34a', borderRadius: 3, width: `${progress}%`, transition: 'width .3s' }} />
              </div>
            </div>

            {/* Zona corrente */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '20px', marginBottom: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{currentZone.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>{currentZone.label}</div>

              {/* 1 — Ultimi 7 giorni */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                  Negli ultimi <strong>7 giorni</strong>, hai avuto dolore in questa zona?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ val: true, label: '😟 Sì' }, { val: false, label: '😊 No' }].map(({ val, label }) => (
                    <button key={String(val)} onClick={() => setPain7(currentZone.key, val)}
                      style={{ flex: 1, padding: '12px', borderRadius: 12, border: '2px solid', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        background: zoneData.pain_7days === val ? (val ? '#fef2f2' : '#f0fdf4') : '#fff',
                        borderColor: zoneData.pain_7days === val ? (val ? '#dc2626' : '#16a34a') : '#e2e8f0',
                        color: zoneData.pain_7days === val ? (val ? '#dc2626' : '#16a34a') : '#374151' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 — Ultimi 12 mesi (auto-Sì se dolore recente) */}
              {(() => {
                const lock12 = zoneData.pain_7days === true;
                const dis12 = zoneData.pain_7days == null || lock12;
                return (
                  <div style={{ marginBottom: 16, opacity: dis12 && !lock12 ? 0.5 : lock12 ? 0.7 : 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                      E negli ultimi <strong>12 mesi</strong>?
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[{ val: true, label: 'Sì' }, { val: false, label: 'No' }].map(({ val, label }) => (
                        <button key={String(val)} onClick={() => setPain12(currentZone.key, val)}
                          style={{ flex: 1, padding: '10px', borderRadius: 10, border: '2px solid', fontSize: 14, fontWeight: 700, cursor: dis12 ? 'not-allowed' : 'pointer',
                            background: zoneData.pain_12m === val ? '#0369a1' : '#fff',
                            borderColor: zoneData.pain_12m === val ? '#0369a1' : '#e2e8f0',
                            color: zoneData.pain_12m === val ? '#fff' : '#374151' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {lock12 && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Compilata in automatico: se hai dolore negli ultimi 7 giorni, rientra anche negli ultimi 12 mesi.</div>}
                    {zoneData.pain_7days == null && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Rispondi prima alla domanda sopra.</div>}
                  </div>
                );
              })()}

              {/* 3 — Impatto funzionale (auto-No se nessun dolore) */}
              {(() => {
                const lockNo = zoneData.pain_7days === false && zoneData.pain_12m === false;
                const disImp = zoneData.pain_7days == null || (zoneData.pain_7days === false && zoneData.pain_12m == null) || lockNo;
                return (
                  <div style={{ opacity: disImp && !lockNo ? 0.5 : lockNo ? 0.7 : 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                      Questo problema ti ha impedito di svolgere le normali attività?
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[{ val: true, label: 'Sì' }, { val: false, label: 'No' }].map(({ val, label }) => (
                        <button key={String(val)} onClick={() => setImpact(currentZone.key, val)}
                          style={{ flex: 1, padding: '10px', borderRadius: 10, border: '2px solid', fontSize: 14, fontWeight: 700, cursor: disImp ? 'not-allowed' : 'pointer',
                            background: zoneData.functional_impact === val ? '#0369a1' : '#fff',
                            borderColor: zoneData.functional_impact === val ? '#0369a1' : '#e2e8f0',
                            color: zoneData.functional_impact === val ? '#fff' : '#374151' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {lockNo && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Compilata in automatico: nessun dolore indicato.</div>}
                  </div>
                );
              })()}
            </div>

            {(() => {
              const zoneDone = zoneData.pain_7days != null && zoneData.pain_12m != null && zoneData.functional_impact != null;
              return (
                <button onClick={nextZone}
                  disabled={!zoneDone}
                  style={{ width: '100%', background: !zoneDone ? '#e2e8f0' : '#0369a1', color: !zoneDone ? '#94a3b8' : '#fff',
                    border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 700, cursor: !zoneDone ? 'not-allowed' : 'pointer' }}>
                  {zoneIndex < NMQ_ZONES.length - 1 ? 'Zona successiva →' : 'Ultima domanda →'}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
