import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const PAIN_ZONES = [
  'Collo', 'Spalle', 'Braccia/gomiti', 'Polsi/mani',
  'Schiena alta', 'Schiena bassa/lombare', 'Anche/glutei',
  'Ginocchia', 'Caviglie/piedi',
];

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

// ─── Evento acuto modal ────────────────────────────────────────────────────────
function AcuteEventModal({ token, onClose, onSent }) {
  const [step, setStep] = useState(1);
  const [desc, setDesc] = useState('');
  const [zone, setZone] = useState('');
  const [nrs, setNrs] = useState(7);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!zone || !desc) return;
    setSending(true);
    try {
      const res = await fetch('/api/employee/acute-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, description: desc, pain_zone: zone, nrs }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Errore'); setSending(false); return; }
      onSent();
    } catch { setError('Errore di rete'); setSending(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#0f172a' }}>🚨 Segnala evento acuto</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Solo per dolore improvviso nelle ultime 72 ore</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Descrizione */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Descrivi brevemente cosa è successo
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value.slice(0, 200))}
              placeholder="Es. Ho sollevato un peso e ho sentito un dolore alla schiena..."
              rows={3}
              style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e2e8f0', padding: '10px 12px', fontSize: 14, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{desc.length}/200</div>
          </div>

          {/* Zona dolore */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Zona principale del dolore</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PAIN_ZONES.map(z => (
                <button key={z} onClick={() => setZone(z)}
                  style={{ padding: '8px 14px', borderRadius: 20, border: '2px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                    background: zone === z ? '#dc2626' : '#fff',
                    borderColor: zone === z ? '#dc2626' : '#e2e8f0',
                    color: zone === z ? '#fff' : '#374151' }}>
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* NRS */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
              Quanto fa male adesso? <span style={{ color: '#dc2626', fontWeight: 800 }}>{nrs}/10</span>
            </label>
            <input type="range" min={0} max={10} value={nrs} onChange={e => setNrs(+e.target.value)}
              style={{ width: '100%', accentColor: '#dc2626' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              <span>0 — nessun dolore</span><span>10 — insopportabile</span>
            </div>
          </div>

          <button onClick={submit} disabled={!zone || !desc || sending}
            style={{ width: '100%', background: (!zone || !desc) ? '#e2e8f0' : '#dc2626', color: (!zone || !desc) ? '#94a3b8' : '#fff',
              border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 700, cursor: (!zone || !desc) ? 'not-allowed' : 'pointer' }}>
            {sending ? 'Invio...' : 'Invia segnalazione'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard L1 ─────────────────────────────────────────────────────────────
function DashboardL1({ patient, cycles, sessions, onAcuteEvent }) {
  const activeCycle = cycles.find(c => c.status === 'active');
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
            <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.5 }}>Sarai contattato dal nostro coordinatore per fissare la pre-validazione clinica (videocall di 20 minuti).</div>
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

      {/* Evento acuto */}
      <AcuteEventButton onPress={onAcuteEvent} />
    </div>
  );
}

// ─── Dashboard L2 ─────────────────────────────────────────────────────────────
function DashboardL2({ patient, miniChecks, onAcuteEvent }) {
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
          {miniChecks.slice(0, 3).map(mc => (
            <div key={mc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ color: '#374151' }}>{mc.check_type?.toUpperCase()} · NRS {mc.nrs_current ?? '—'}</span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{new Date(mc.created_at).toLocaleDateString('it-IT')}</span>
            </div>
          ))}
        </div>
      )}

      <AcuteEventButton onPress={onAcuteEvent} />
    </div>
  );
}

// ─── Dashboard L3 ─────────────────────────────────────────────────────────────
function DashboardL3({ patient }) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #166534 0%, #16a34a 100%)', borderRadius: 18, padding: '20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Il tuo programma ES Work</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Ottima salute muscolo-scheletrica! 🎉</div>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.6 }}>
          Il tuo assessment indica una buona condizione fisica. Parteciperai alla formazione collettiva per mantenere e migliorare il tuo stato. Il programma resta a tua disposizione tramite i mini-check periodici.
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>📚 Formazione collettiva</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>Le sessioni di formazione ergonomica sono incluse nel tuo programma. Riceverai le date via mail dalla tua azienda.</div>
      </div>
    </div>
  );
}

// ─── Bottone evento acuto (criterio stringente) ───────────────────────────────
function AcuteEventButton({ onPress }) {
  return (
    <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 14, padding: '16px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>🚨 Segnala evento acuto</div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        Solo per: eventi traumatici (caduta, distorsione, sollevamento errato) o acutizzazioni nelle <strong>ultime 72 ore</strong> con dolore intenso.
      </div>
      <button onClick={onPress} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
        Segnala ora
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
  const [showAcute, setShowAcute] = useState(false);
  const [acuteSent, setAcuteSent] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/employee/${token}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
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
                  ? <DashboardL1 patient={patient} cycles={cycles} sessions={sessions} onAcuteEvent={() => setShowAcute(true)} />
                  : level === 'level2'
                    ? <DashboardL2 patient={patient} miniChecks={miniChecks} onAcuteEvent={() => setShowAcute(true)} />
                    : <DashboardL3 patient={patient} />
              }

              {/* Footer */}
              <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #e2e8f0', marginTop: 8 }}>
                🔒 Dati protetti · Connessione cifrata (HTTPS) · Server UE<br />
                Le tue risposte sono anonime e non visibili al datore di lavoro.
              </div>
            </>
          );
        })()}

        {acuteSent && (
          <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '14px 24px', borderRadius: 14, fontWeight: 700, fontSize: 14, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            ✅ Segnalazione inviata — sarai contattato entro 24h
          </div>
        )}

        {showAcute && (
          <AcuteEventModal
            token={token}
            onClose={() => setShowAcute(false)}
            onSent={() => { setShowAcute(false); setAcuteSent(true); setTimeout(() => setAcuteSent(false), 5000); }}
          />
        )}
      </div>
    </>
  );
}
