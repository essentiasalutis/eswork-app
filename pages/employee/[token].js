import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

// ─── Header ────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div style={{ background: '#1e293b', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, background: '#16a34a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌿</div>
      <div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>ES Work</div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>by Essentia Salutis</div>
      </div>
    </div>
  );
}

// ─── Self-trigger modal (mini-triage, NESSUN NRS) ──────────────────────────────
const DURATIONS = ['Meno di 1 settimana', '1-4 settimane', 'Più di 1 mese'];

function SelfTriggerModal({ token, onClose, onSent }) {
  const [disturbance, setDisturbance] = useState('');
  const [functionalImpact, setFunctionalImpact] = useState(null);
  const [duration, setDuration] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = disturbance.trim() && functionalImpact !== null && duration;

  async function submit() {
    if (!canSubmit) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/employee/self-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, disturbance, functional_impact: functionalImpact, duration, urgent, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Errore'); setSending(false); return; }
      onSent(data.remaining);
    } catch { setError('Errore di rete'); setSending(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>Ho iniziato ad avere un disturbo</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Poche domande: poi un osteopata ti ricontatta in videochiamata</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', margin: '12px 0' }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          {/* Disturbo */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Che disturbo hai iniziato ad avvertire?
            </label>
            <textarea value={disturbance} onChange={e => setDisturbance(e.target.value.slice(0, 200))}
              placeholder="Es. dolore alla schiena bassa, fastidio al collo..."
              rows={3}
              style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e2e8f0', padding: '10px 12px', fontSize: 14, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{disturbance.length}/200</div>
          </div>

          {/* Impatto funzionale */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Il disturbo limita le tue attività quotidiane o lavorative?</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ val: false, label: '😊 No' }, { val: true, label: '😟 Sì' }].map(({ val, label }) => (
                <button key={String(val)} onClick={() => setFunctionalImpact(val)}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, border: '2px solid', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    background: functionalImpact === val ? (val ? '#dc2626' : '#16a34a') : '#fff',
                    borderColor: functionalImpact === val ? (val ? '#dc2626' : '#16a34a') : '#e2e8f0',
                    color: functionalImpact === val ? '#fff' : '#374151' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Durata */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Da quanto tempo?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  style={{ padding: '12px 14px', borderRadius: 12, border: '2px solid', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                    background: duration === d ? '#0369a1' : '#fff', borderColor: duration === d ? '#0369a1' : '#e2e8f0',
                    color: duration === d ? '#fff' : '#374151' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Urgente */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: '#ea580c' }} />
            <span style={{ fontSize: 13, color: '#9a3412', lineHeight: 1.5 }}>
              <strong>È un caso urgente</strong> (evento traumatico recente — caduta, distorsione, sollevamento errato — o dolore intenso e improvviso). Verrà gestito con priorità.
            </span>
          </label>

          {/* Note */}
          <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))}
            placeholder="Aggiungi una nota (facoltativo)..." rows={2}
            style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e2e8f0', padding: '10px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />

          <button onClick={submit} disabled={!canSubmit || sending}
            style={{ width: '100%', background: !canSubmit ? '#e2e8f0' : '#16a34a', color: !canSubmit ? '#94a3b8' : '#fff',
              border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 700, cursor: !canSubmit ? 'not-allowed' : 'pointer' }}>
            {sending ? 'Invio...' : 'Invia segnalazione'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard L1 ─────────────────────────────────────────────────────────────
function DashboardL1({ patient, cycles, sessions, onSelfTrigger, remaining }) {
  const activeCycle = cycles.find(c => c.status === 'active' || c.status === 'pending_pgic');
  const closedCycles = cycles.filter(c => c.status === 'closed');
  // Self-trigger per L1 solo a fine ciclo (per richiedere il 2° ciclo), non durante
  const canSelfTrigger = !activeCycle && closedCycles.length > 0 && closedCycles.length < 2;
  const nrsInitial = sessions[sessions.length - 1]?.nrs_pre;
  const nrsLast = sessions.find(s => s.nrs_post != null)?.nrs_post;
  const isCandidate = !activeCycle && cycles.length === 0;

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status card */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0369a1 100%)', borderRadius: 18, padding: '20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Il tuo programma ES Work</div>
        {isCandidate ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Sei stato identificato come candidato al protocollo di trattamento.</div>
            <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.5 }}>Sarai contattato dal nostro coordinatore per fissare la pre-validazione clinica (videocall di 15 minuti).</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Sei in protocollo di trattamento attivo.</div>
            {activeCycle && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, opacity: .7, marginBottom: 4 }}>Sessioni completate</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1,2,3,4].map(n => (
                    <div key={n} style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                      background: n <= activeCycle.sessions_completed ? '#16a34a' : 'rgba(255,255,255,0.2)', color: '#fff' }}>
                      {n <= activeCycle.sessions_completed ? '✓' : n}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* NRS trend */}
      {(nrsInitial != null || nrsLast != null) && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>📊 Andamento dolore</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {nrsInitial != null && (
              <div style={{ flex: 1, background: '#fef2f2', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{nrsInitial}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>NRS iniziale</div>
              </div>
            )}
            {nrsLast != null && (
              <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{nrsLast}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>NRS attuale</div>
              </div>
            )}
            {nrsInitial != null && nrsLast != null && (
              <div style={{ flex: 1, background: nrsLast < nrsInitial ? '#f0fdf4' : '#fef9c3', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: nrsLast < nrsInitial ? '#16a34a' : '#ca8a04' }}>
                  {nrsLast < nrsInitial ? '↓' : nrsLast > nrsInitial ? '↑' : '→'}{Math.abs(nrsLast - nrsInitial)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Variazione</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Self-trigger — solo a fine ciclo per richiedere il 2° ciclo */}
      {canSelfTrigger && <SelfTriggerButton onPress={onSelfTrigger} remaining={remaining} label="Richiedi un nuovo ciclo" />}
    </div>
  );
}

// ─── Dashboard L2 ─────────────────────────────────────────────────────────────
function DashboardL2({ patient, miniChecks, onSelfTrigger, remaining }) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0369a1 100%)', borderRadius: 18, padding: '20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Il tuo programma ES Work</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Sei in monitoraggio preventivo.</div>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.6 }}>
          Il tuo assessment indica una situazione che non richiede trattamento attivo al momento. Sei monitorato con i mini-check a 3 e 6 mesi.<br />
          Se il tuo stato cambia, puoi segnalarlo tramite il bottone qui sotto.
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>📚 Formazione collettiva</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>Le prossime sessioni di formazione ergonomica e posturale saranno comunicate dalla tua azienda via mail.</div>
      </div>

      {miniChecks.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>📋 Storico mini-check</div>
          {miniChecks.slice(0, 3).map(mc => {
            const PGIC_LABEL = { 1: 'Molto peggio', 2: 'Peggio', 3: 'Invariato', 4: 'Meglio', 5: 'Molto meglio' };
            return (
              <div key={mc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                <span style={{ color: '#374151' }}>{mc.check_type?.toUpperCase()} · {mc.pgic ? PGIC_LABEL[mc.pgic] : '—'}</span>
                <span style={{ color: '#64748b', fontSize: 11 }}>{new Date(mc.created_at).toLocaleDateString('it-IT')}</span>
              </div>
            );
          })}
        </div>
      )}

      <SelfTriggerButton onPress={onSelfTrigger} remaining={remaining} />
    </div>
  );
}

// ─── Dashboard L3 ─────────────────────────────────────────────────────────────
function DashboardL3({ patient, onSelfTrigger, remaining }) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #166534 0%, #16a34a 100%)', borderRadius: 18, padding: '20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Il tuo programma ES Work</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Ottima salute dell'apparato muscolo-scheletrico! 🎉</div>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.6 }}>
          Il tuo assessment indica una buona condizione fisica. Parteciperai alla formazione collettiva per mantenere e migliorare il tuo stato. Il programma resta a tua disposizione tramite i mini-check periodici.
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>📚 Formazione collettiva</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>Le sessioni di formazione ergonomica sono incluse nel tuo programma. Riceverai le date via mail dalla tua azienda.</div>
      </div>

      <SelfTriggerButton onPress={onSelfTrigger} remaining={remaining} />
    </div>
  );
}

// ─── Bottone self-trigger (auto-segnalazione, max 2/anno) ──────────────────────
function SelfTriggerButton({ onPress, remaining = 2, label = 'Ho iniziato ad avere un disturbo' }) {
  const exhausted = remaining <= 0;
  return (
    <div style={{ background: exhausted ? '#f8fafc' : '#eff6ff', border: `1.5px solid ${exhausted ? '#e2e8f0' : '#bfdbfe'}`, borderRadius: 14, padding: '16px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: exhausted ? '#64748b' : '#1d4ed8', marginBottom: 4 }}>🩺 {label}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        Se avverti un nuovo disturbo, segnalalo: un osteopata ti ricontatterà per una breve videochiamata di valutazione.
        <br /><strong>{remaining}</strong> {remaining === 1 ? 'segnalazione disponibile' : 'segnalazioni disponibili'} quest&apos;anno.
      </div>
      <button onClick={onPress} disabled={exhausted}
        style={{ background: exhausted ? '#e2e8f0' : '#0369a1', color: exhausted ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: exhausted ? 'not-allowed' : 'pointer', width: '100%' }}>
        {exhausted ? 'Limite annuale raggiunto' : 'Segnala ora'}
      </button>
    </div>
  );
}

// ─── Opted-out screen ─────────────────────────────────────────────────────────
function OptedOutScreen({ patient }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Percorso completato</div>
      <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
        Hai completato i due cicli di trattamento previsti dal protocollo. Il coordinatore ti contatterà per valutare i prossimi passi. Grazie per aver partecipato al programma.
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const router = useRouter();
  const { token } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSelfTrigger, setShowSelfTrigger] = useState(false);
  const [sentToast, setSentToast] = useState(false);
  const [remaining, setRemaining] = useState(2);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/employee/${token}`)
      .then(r => r.json())
      .then(d => { setData(d); setRemaining(d?.selfTriggerBudget?.remaining ?? 2); setLoading(false); })
      .catch(() => { setError('Errore di rete'); setLoading(false); });
  }, [token]);

  return (
    <>
      <Head><title>Il tuo programma — ES Work</title></Head>
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 520, margin: '0 auto' }}>
        <Header />

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>Caricamento...</div>
          </div>
        )}

        {!loading && (error || data?.error) && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Link non valido</div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Questo link non è più valido o non esiste. Contatta la tua azienda per riceverne uno nuovo.</div>
          </div>
        )}

        {!loading && data && !data.error && (() => {
          const { patient, cycles, sessions, miniChecks } = data;
          const level = patient.level || 'level3';
          const isOptedOut = patient.level_status === 'opted_out';

          return (
            <>
              {/* Patient greeting */}
              <div style={{ padding: '20px 16px 4px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Ciao, {patient.first_name}! 👋</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  {patient.clients?.name && <span>{patient.clients.name} · </span>}
                  <span style={{ fontWeight: 600, color: level === 'level1' ? '#1d4ed8' : level === 'level2' ? '#92400e' : '#166534' }}>
                    {level === 'level1' ? 'Livello 1 — Trattamento attivo' : level === 'level2' ? 'Livello 2 — Monitoraggio' : 'Livello 3 — Prevenzione'}
                  </span>
                </div>
              </div>

              {isOptedOut
                ? <OptedOutScreen patient={patient} />
                : level === 'level1'
                  ? <DashboardL1 patient={patient} cycles={cycles} sessions={sessions} onSelfTrigger={() => setShowSelfTrigger(true)} remaining={remaining} />
                  : level === 'level2'
                    ? <DashboardL2 patient={patient} miniChecks={miniChecks} onSelfTrigger={() => setShowSelfTrigger(true)} remaining={remaining} />
                    : <DashboardL3 patient={patient} onSelfTrigger={() => setShowSelfTrigger(true)} remaining={remaining} />
              }

              {/* Footer */}
              <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
                🔒 Dati protetti · Connessione cifrata (HTTPS) · Server UE<br />
                Le tue risposte sono riservate e non visibili al datore di lavoro.
              </div>
            </>
          );
        })()}

        {sentToast && (
          <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '14px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            ✅ Segnalazione inviata — un osteopata ti ricontatterà
          </div>
        )}

        {showSelfTrigger && (
          <SelfTriggerModal
            token={token}
            onClose={() => setShowSelfTrigger(false)}
            onSent={(rem) => { setShowSelfTrigger(false); if (typeof rem === 'number') setRemaining(rem); setSentToast(true); setTimeout(() => setSentToast(false), 5000); }}
          />
        )}
      </div>
    </>
  );
}
