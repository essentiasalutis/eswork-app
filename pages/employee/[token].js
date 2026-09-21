import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { RIGA_AREA_NON_ATTIVA } from '../../lib/attivazione';
import { etichettaLivello } from '../../lib/livelli';
import { dataIt } from '../../lib/date-it.mjs';
import { PROTOCOLLO, inLettere } from '../../lib/protocollo.mjs';

// ─── Header ────────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div style={{ background: '#1e293b', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Il marchio, non un'emoji. Il logo è scuro su trasparente: su questo header
          scuro va appoggiato su una pastiglia chiara, altrimenti sparisce. */}
      <div style={{ width: 38, height: 38, background: '#fff', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, boxSizing: 'border-box' }}>
        <img src="/logo-es.png" alt="Essentia Salutis" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
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
function DashboardL1({ patient, cycles, nrs, onSelfTrigger, remaining, rinnovo = null, attivo = true }) {
  const activeCycle = cycles.find(c => c.status === 'active' || c.status === 'pending_pgic');
  const closedCycles = cycles.filter(c => c.status === 'closed');
  // Self-trigger per L1 solo a fine ciclo (per richiedere il 2° ciclo), non durante
  const canSelfTrigger = !activeCycle && closedCycles.length > 0 && closedCycles.length < 2;
  // Iniziale = prima seduta, attuale = ultima. Li calcola il server (lib/vista.js):
  // fino al 12/9 erano invertiti e chi migliorava leggeva che peggiorava.
  const nrsInitial = nrs?.iniziale ?? null;
  const nrsLast = nrs?.attuale ?? null;
  const isCandidate = !activeCycle && cycles.length === 0;

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status card */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0369a1 100%)', borderRadius: 18, padding: '20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Il tuo programma ES Work</div>
        {isCandidate ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Sei stato identificato come candidato al protocollo di trattamento.</div>
            <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.5 }}>{attivo
              ? `Sarai contattato dal nostro coordinatore per fissare la pre-validazione clinica (videocall di ${PROTOCOLLO.durata_prevalidazione_min} minuti).`
              : `Se il programma verrà attivato, sarai contattato dal nostro coordinatore per fissare la pre-validazione clinica (videochiamata di circa ${PROTOCOLLO.durata_prevalidazione_min} minuti).`}</div>
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

      <CheckPeriodici attivo={attivo} />

      {/* Self-trigger — solo a fine ciclo per richiedere il 2° ciclo */}
      {canSelfTrigger && <SelfTriggerButton onPress={onSelfTrigger} remaining={remaining} rinnovo={rinnovo} label="Richiedi un nuovo ciclo" attivo={attivo} />}
    </div>
  );
}

// ─── Dashboard L2 ─────────────────────────────────────────────────────────────
function DashboardL2({ patient, percorso = [], onSelfTrigger, remaining, rinnovo = null, attivo = true }) {
  // I mini-check non viaggiano più come lista a sé: vivono nel percorso (fonte unica).
  // La resa resta quella di prima — "T3 · Molto meglio" e la data — e la parola del
  // PGIC è quella scelta rispondendo (lib/pgic.js).
  const miniChecks = percorso.filter(r => r.tipo === 'minicheck');
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0369a1 100%)', borderRadius: 18, padding: '20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Il tuo programma ES Work</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Sei nella prevenzione attiva.</div>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.6 }}>
          Il tuo check-up ha rilevato disturbi iniziali che non limitano ancora la tua attività.{' '}
          {attivo ? (
            <>Il programma prevede per te {PROTOCOLLO.sessioni_prevenzione_l2} sessioni di prevenzione con l&apos;osteopata, in sede.<br />
            Se il tuo stato cambia, puoi segnalarlo tramite il bottone qui sotto.</>
          ) : (
            <>Se il programma verrà attivato, prevede per te {PROTOCOLLO.sessioni_prevenzione_l2} sessioni di prevenzione con l&apos;osteopata, in sede.</>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>📚 Formazione collettiva</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>{attivo
          ? 'Le prossime sessioni di formazione ergonomica e posturale saranno comunicate dalla tua azienda via mail.'
          : 'Se il programma verrà attivato, le sessioni di formazione ergonomica e posturale saranno comunicate dalla tua azienda via mail.'}</div>
      </div>

      {miniChecks.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>📋 Storico mini-check</div>
          {miniChecks.slice(0, 3).map((mc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ color: '#374151' }}>{mc.momento?.toUpperCase()} · {mc.pgic || '—'}</span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{mc.data ? dataIt(mc.data) : '—'}</span>
            </div>
          ))}
        </div>
      )}

      <CheckPeriodici attivo={attivo} />
      <SelfTriggerButton onPress={onSelfTrigger} remaining={remaining} rinnovo={rinnovo} attivo={attivo} />
    </div>
  );
}

// ─── Il mio percorso ──────────────────────────────────────────────────────────
// Ciò che è avvenuto: sedute svolte, mini-check, rivalutazione annuale. Lo vede solo
// il dipendente col suo link. Niente nome dell'osteopata, niente note di trattamento
// (decisione Enrico, 12/9): quelle restano nella cartella del professionista.
function MioPercorso({ percorso = [] }) {
  if (!percorso.length) return null;
  const data = d => (d ? dataIt(d, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  return (
    <div style={{ padding: '0 16px 20px' }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>🗂 Il mio percorso</div>
        {percorso.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: i === percorso.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                {r.tipo === 'seduta'
                  ? `Seduta${r.numero ? ` ${r.numero}` : ''}${r.su ? ` di ${r.su}` : ''}${r.ciclo ? ` · ciclo ${r.ciclo}` : ''}`
                  : r.tipo === 'minicheck'
                    ? `Mini-check ${String(r.momento || '').toUpperCase()}`
                    : 'Rivalutazione annuale'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {r.tipo === 'seduta'
                  ? (r.nrsPre != null || r.nrsPost != null
                      ? `Dolore ${r.nrsPre != null ? r.nrsPre : '—'} → ${r.nrsPost != null ? r.nrsPost : '—'}${r.nrsPre != null && r.nrsPost != null && r.nrsPre !== r.nrsPost ? ` (${r.nrsPost < r.nrsPre ? '−' : '+'}${Math.abs(r.nrsPre - r.nrsPost)})` : ''}`
                      : 'Seduta svolta')
                  : (r.pgic || '—')}
              </div>
            </div>
            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', paddingTop: 2 }}>{data(r.data)}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>Queste informazioni sono tue e non sono visibili al datore di lavoro.</p>
      </div>
    </div>
  );
}

// ─── Dashboard L3 ─────────────────────────────────────────────────────────────
function DashboardL3({ patient, onSelfTrigger, remaining, rinnovo = null, attivo = true }) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #166534 0%, #16a34a 100%)', borderRadius: 18, padding: '20px', color: '#fff' }}>
        <div style={{ fontSize: 12, opacity: .8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Il tuo programma ES Work</div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>Ottima salute dell'apparato muscolo-scheletrico! 🎉</div>
        <div style={{ fontSize: 13, opacity: .85, marginTop: 8, lineHeight: 1.6 }}>
          Il tuo check-up indica una buona condizione fisica.{' '}
          {attivo
            ? 'Parteciperai alla formazione collettiva per mantenere e migliorare il tuo stato.'
            : 'Se il programma verrà attivato, parteciperai alla formazione collettiva per mantenere e migliorare il tuo stato.'}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>📚 Formazione collettiva</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>{attivo
          ? 'Le sessioni di formazione ergonomica sono incluse nel tuo programma. Riceverai le date via mail dalla tua azienda.'
          : 'Se il programma verrà attivato, le sessioni di formazione ergonomica saranno incluse: riceverai le date via mail dalla tua azienda.'}</div>
      </div>

      <CheckPeriodici attivo={attivo} />
      <SelfTriggerButton onPress={onSelfTrigger} remaining={remaining} rinnovo={rinnovo} attivo={attivo} />
    </div>
  );
}

// ─── I check periodici — una frase sola, uguale per tutti i livelli ──────────
// Chi riceve cosa (verificato sul codice degli inviti, 13/9):
//  · mini-check a 3 mesi → solo chi ha un percorso aperto con l'osteopata, e parte
//    dall'inizio del ciclo, non dal check-up;
//  · ri-fotografia a 6 mesi → TUTTA la popolazione, Livello 3 compreso, a 180 giorni
//    dalla compilazione del check-up.
// Prima il Livello 2 se li prendeva entrambi come cosa sua e il Livello 3 leggeva di
// «mini-check periodici» che non riceve mai: promesse che gli inviti non mantengono.
function CheckPeriodici({ attivo = true }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>🗓 I check periodici</div>
      <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
        {attivo ? 'A sei mesi' : 'Se il programma verrà attivato, a sei mesi'} ti chiederemo di ripetere il check-up: stesse domande, cinque minuti.
        Serve a vedere com&apos;è cambiata la situazione complessiva. Se stai seguendo un percorso con l&apos;osteopata,
        a tre mesi c&apos;è anche un breve mini-check sul tuo andamento.
      </div>
    </div>
  );
}

// ─── Bottone self-trigger (auto-segnalazione, max 2/anno) ──────────────────────
// Prima che il programma sia attivo il pulsante NON c'è: al suo posto una riga che
// spiega perché. Premerlo avvierebbe una presa in carico fuori contratto — il
// rifiuto vero sta comunque sul server (lib/attivazione).
function SelfTriggerButton({ onPress, remaining = 2, rinnovo = null, label = 'Ho iniziato ad avere un disturbo', attivo = true }) {
  if (!attivo) {
    return (
      <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>⏳ Programma non ancora attivo</div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{RIGA_AREA_NON_ATTIVA}</div>
      </div>
    );
  }
  const exhausted = remaining <= 0;
  return (
    <div style={{ background: exhausted ? '#f8fafc' : '#eff6ff', border: `1.5px solid ${exhausted ? '#e2e8f0' : '#bfdbfe'}`, borderRadius: 14, padding: '16px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: exhausted ? '#64748b' : '#1d4ed8', marginBottom: 4 }}>🩺 {label}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        Se avverti un nuovo disturbo, segnalalo: un osteopata ti ricontatterà per una breve videochiamata di valutazione.
        <br /><strong>{remaining}</strong> {remaining === 1 ? 'segnalazione disponibile' : 'segnalazioni disponibili'} nell&apos;anno di programma della tua azienda.
        {exhausted && rinnovo && <><br />Tornano disponibili il {rinnovo}.</>}
      </div>
      <button onClick={onPress} disabled={exhausted}
        style={{ background: exhausted ? '#e2e8f0' : '#0369a1', color: exhausted ? '#94a3b8' : '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: exhausted ? 'not-allowed' : 'pointer', width: '100%' }}>
        {exhausted ? 'Limite dell\'anno di programma raggiunto' : 'Segnala ora'}
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
        Hai completato i {inLettere(PROTOCOLLO.cicli_trattamento_per_anno)} cicli di trattamento previsti dal protocollo. Il coordinatore ti contatterà per valutare i prossimi passi. Grazie per aver partecipato al programma.
      </div>
    </div>
  );
}

// ─── Diritti GDPR (area personale) ───────────────────────────────────────────

function RightsSection({ token, patient }) {
  const [openForm, setOpenForm] = useState(null); // 'rectification' | 'erasure' | 'withdrawal' | null
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // messaggio di conferma
  const withdrawn = !!patient.consent_withdrawn_at;

  async function submit(type) {
    setBusy(true);
    try {
      const res = await fetch(`/api/employee/${token}/data-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(type === 'consent_withdrawal'
          ? 'Consenso revocato. I trattamenti non obbligatori sono stati interrotti.'
          : 'Richiesta inviata. Il titolare la prenderà in carico e ti risponderà.');
        setOpenForm(null); setNote('');
      } else { alert(d.error || 'Errore'); }
    } catch { alert('Errore di rete'); }
    setBusy(false);
  }

  const btn = (bg, color, border) => ({
    width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12,
    border: `1px solid ${border}`, background: bg, color, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', marginBottom: 8,
  });

  return (
    <div style={{ padding: '8px 16px 4px' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>🔐 I tuoi diritti sui dati (GDPR)</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
          Puoi esercitare i tuoi diritti direttamente da qui. Le richieste sono registrate e gestite dal titolare (Essentia Salutis).
        </div>

        {done && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 10 }}>
            ✅ {done}
          </div>
        )}

        <a href={`/api/employee/${token}/export`} style={{ ...btn('#eff6ff', '#1d4ed8', '#bfdbfe'), display: 'block', textDecoration: 'none' }}>
          📥 Scarica una copia dei miei dati
        </a>

        <button onClick={() => { setOpenForm(openForm === 'rectification' ? null : 'rectification'); setNote(''); }} style={btn('#f8fafc', '#0f172a', '#e2e8f0')}>
          ✏️ Richiedi una rettifica dei miei dati
        </button>
        {openForm === 'rectification' && (
          <RequestForm note={note} setNote={setNote} busy={busy} placeholder="Indica cosa è inesatto e come va corretto…" onSend={() => submit('rectification')} />
        )}

        <button onClick={() => { setOpenForm(openForm === 'erasure' ? null : 'erasure'); setNote(''); }} style={btn('#f8fafc', '#0f172a', '#e2e8f0')}>
          🗑️ Richiedi la cancellazione dei miei dati
        </button>
        {openForm === 'erasure' && (
          <div>
            <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 10px', margin: '0 0 8px', lineHeight: 1.5 }}>
              Nota: la documentazione clinica è conservata per l'obbligo legale di documentazione sanitaria ({PROTOCOLLO.anni_conservazione} anni) e viene cancellata dal titolare alla scadenza. Gli altri dati possono essere cancellati su tua richiesta.
            </div>
            <RequestForm note={note} setNote={setNote} busy={busy} placeholder="Motivo della richiesta (facoltativo)…" onSend={() => submit('erasure')} />
          </div>
        )}

        {withdrawn ? (
          <div style={{ ...btn('#f1f5f9', '#64748b', '#e2e8f0'), cursor: 'default' }}>
            🚫 Consenso revocato il {dataIt(patient.consent_withdrawn_at)}
          </div>
        ) : (
          <>
            <button onClick={() => setOpenForm(openForm === 'withdrawal' ? null : 'withdrawal')} style={btn('#fef2f2', '#b91c1c', '#fecaca')}>
              🚫 Revoca il consenso al trattamento
            </button>
            {openForm === 'withdrawal' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.5, marginBottom: 10 }}>
                  La revoca interrompe i trattamenti non obbligatori (promemoria, inviti, nuove campagne). La documentazione clinica già raccolta resta conservata per l'obbligo legale e poi viene cancellata dal titolare. Confermi?
                </div>
                <button onClick={() => submit('consent_withdrawal')} disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Invio…' : 'Conferma revoca del consenso'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RequestForm({ note, setNote, busy, placeholder, onSend }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <textarea
        value={note} onChange={e => setNote(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginBottom: 8 }}
      />
      <button onClick={onSend} disabled={busy} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Invio…' : 'Invia richiesta'}
      </button>
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
  const [rinnovo, setRinnovo] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/employee/${token}`)
      .then(r => r.json())
      .then(d => { setData(d); setRemaining(d?.selfTriggerBudget?.remaining ?? 2); setRinnovo(d?.selfTriggerBudget?.rinnovoIl || null); setLoading(false); })
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
          const { patient, cycles, nrs, percorso = [] } = data;
          // Fail-closed: se il dato non arriva, i pulsanti del percorso restano spenti.
          const attivo = !!data.programmaAttivo;
          const level = patient.level || 'level3';
          const isOptedOut = patient.level_status === 'opted_out';

          return (
            <>
              {/* Patient greeting */}
              <div style={{ padding: '20px 16px 4px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Ciao{patient.first_name && !['Anonimo', 'Nome non indicato'].includes(patient.first_name) ? `, ${patient.first_name}` : ''}! 👋</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  {patient.azienda && <span>{patient.azienda} · </span>}
                  <span style={{ fontWeight: 600, color: level === 'level1' ? '#1d4ed8' : level === 'level2' ? '#92400e' : '#166534' }}>
                    {/* Nomi dalla fonte unica (lib/livelli): Trattamento · Prevenzione ·
                        Formazione. «Trattamento ATTIVO» contraddiceva il riquadro sotto,
                        che prima della firma dice «se il programma verrà attivato». */}
                    {etichettaLivello(level)}
                  </span>
                </div>
              </div>

              {isOptedOut
                ? <OptedOutScreen patient={patient} />
                : level === 'level1'
                  ? <DashboardL1 patient={patient} cycles={cycles} nrs={nrs} onSelfTrigger={() => setShowSelfTrigger(true)} remaining={remaining} rinnovo={rinnovo} attivo={attivo} />
                  : level === 'level2'
                    ? <DashboardL2 patient={patient} percorso={percorso} onSelfTrigger={() => setShowSelfTrigger(true)} remaining={remaining} rinnovo={rinnovo} attivo={attivo} />
                    : <DashboardL3 patient={patient} onSelfTrigger={() => setShowSelfTrigger(true)} remaining={remaining} rinnovo={rinnovo} attivo={attivo} />
              }

              {/* Il mio percorso — per tutti i livelli, solo se c'è qualcosa da mostrare */}
              {!isOptedOut && <MioPercorso percorso={percorso} />}

              {/* Diritti GDPR */}
              <RightsSection token={token} patient={patient} />

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
