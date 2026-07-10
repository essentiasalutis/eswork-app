// Componente CONDIVISO del questionario NMQ — SOLO PRESENTAZIONE.
// Renderizza le domande di UNA zona corpo + progress + navigazione (next/back) e
// raccoglie le risposte in forma nmq_{zi}_{qi} (0 = 12 mesi, 1 = impatto, 2 = 7 giorni).
// NON contiene submit/routing/client_code: il genitore decide cosa fa il completamento
// via il callback onComplete. Usato da self-declare (/q/c/[client_code]) e dal neoassunto
// (/invito/[token]) → UNA sola fonte del renderer clinico che determina L1/L2/L3.
import { BODY_ZONES } from '../lib/scoring';

// ─── NMQ: bottone Sì/No ───────────────────────────────────────────────────────
function YesNoBtn({ value, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="flex-1 py-3 rounded-xl border-2 text-base font-semibold transition-all"
      style={{
        borderColor: selected ? '#16a34a' : '#e5e7eb',
        background: selected ? '#dcfce7' : '#fff',
        color: selected ? '#166534' : '#6b7280',
      }}
    >
      {value === 1 ? 'Sì' : 'No'}
    </button>
  );
}

// ─── NMQ: zona corpo ──────────────────────────────────────────────────────────
function NMQZone({ zone, zi, answers, setAnswer }) {
  // Ordine: 7 giorni → 12 mesi → impatto. Le chiavi salvate restano invariate
  // (nmq_z_0 = 12 mesi, _1 = impatto, _2 = 7 giorni) per stratificazione e report.
  // Coerenza automatica (riduce risposte logicamente impossibili):
  //   7gg = SÌ  → 12 mesi auto-SÌ (bloccata) · impatto scelta libera
  //   7gg = NO  → 12 mesi scelta libera
  //     12 mesi = NO → impatto auto-NO (bloccato)
  //     12 mesi = SÌ → impatto scelta libera
  const k7 = `nmq_${zi}_2`, k12 = `nmq_${zi}_0`, kImp = `nmq_${zi}_1`;
  const v7 = answers[k7], v12 = answers[k12];

  const lock12 = v7 === 1;                  // dolore recente ⇒ rientra nei 12 mesi
  const lockImp = v7 === 0 && v12 === 0;    // nessun dolore ⇒ nessun impatto
  const impDisabled = v7 === undefined || (v7 === 0 && v12 === undefined) || lockImp;

  function set7(v) {
    setAnswer(k7, v);
    if (v === 1) {
      setAnswer(k12, 1);          // auto-flag 12 mesi
      setAnswer(kImp, undefined); // impatto: scelta esplicita
    } else {
      setAnswer(k12, undefined);  // 12 mesi torna scelta libera
      setAnswer(kImp, undefined);
    }
  }
  function set12(v) {
    if (lock12) return;
    setAnswer(k12, v);
    setAnswer(kImp, v === 0 ? 0 : undefined); // no+no → impatto auto-NO; sì → scelta
  }
  function setImp(v) {
    if (impDisabled) return;
    setAnswer(kImp, v);
  }

  const questions = [
    { key: k7, label: <>Negli ultimi <strong>7 giorni</strong>, hai avuto fastidi o dolori a: <strong>{zone.toLowerCase()}</strong>?</>, onSelect: set7, locked: false, note: null },
    { key: k12, label: <>E negli ultimi <strong>12 mesi</strong>?</>, onSelect: set12, locked: lock12, note: lock12 ? 'Compilata in automatico: se hai dolore negli ultimi 7 giorni, rientra anche negli ultimi 12 mesi.' : null },
    { key: kImp, label: <>Questo problema ti ha impedito di svolgere le normali attività?</>, onSelect: setImp, locked: impDisabled, note: lockImp ? 'Compilata in automatico: nessun dolore indicato.' : (v7 === undefined || (v7 === 0 && v12 === undefined)) ? 'Rispondi prima alle domande sopra.' : null },
  ];

  return (
    <div className="space-y-4">
      {/* Intestazione zona — solo nome, senza icona */}
      <div className="bg-green-50 rounded-2xl p-4 text-center">
        <div className="font-bold text-green-800 text-lg">{zone}</div>
      </div>
      {questions.map(q => (
        <div key={q.key} className={`bg-white rounded-2xl border border-gray-200 p-4 ${q.locked ? 'opacity-70' : ''}`}>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{q.label}</p>
          <div className="flex gap-2">
            <YesNoBtn value={1} selected={answers[q.key] === 1} onSelect={v => q.onSelect(v)} />
            <YesNoBtn value={0} selected={answers[q.key] === 0} onSelect={v => q.onSelect(v)} />
          </div>
          {q.note && <p className="text-xs text-gray-400 mt-2">{q.note}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Progress bar NMQ ─────────────────────────────────────────────────────────
function NMQProgress({ step, total }) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-green-500 transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Questionario NMQ (una zona per step) ─────────────────────────────────────
// onComplete: chiamato all'ultimo step quando l'utente conferma. Il genitore decide
// il submit (self-declare → /api/self-declare ; neoassunto → /api/invito/submit).
export function NmqQuestionnaire({ answers, setAnswer, step, onNext, onBack, onComplete, isLast, submitting, submitError }) {
  const zone = BODY_ZONES[step];
  const zi = step;
  const keys = [`nmq_${zi}_0`, `nmq_${zi}_1`, `nmq_${zi}_2`];
  const allAnswered = keys.every(k => answers[k] !== undefined);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-gray-900">ES <span className="text-green-600">Work</span></div>
            <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              Riservato
            </div>
          </div>
          <NMQProgress step={step} total={BODY_ZONES.length} />
          <div className="flex justify-between mt-1.5">
            <div className="text-xs font-semibold text-green-600">Salute fisica</div>
            <div className="text-xs text-gray-400">{step + 1} di {BODY_ZONES.length}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        <NMQZone zone={zone} zi={zi} answers={answers} setAnswer={setAnswer} />
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          {submitError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              ⚠️ {submitError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onBack}
              disabled={submitting}
              className="py-4 px-5 rounded-2xl border border-gray-300 text-gray-600 font-semibold text-base disabled:opacity-40"
            >
              ←
            </button>
            {isLast ? (
              <button
                onClick={onComplete}
                disabled={!allAnswered || submitting}
                className="flex-1 py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-40"
              >
                {submitting ? 'Invio in corso...' : '✓ Completa e invia'}
              </button>
            ) : (
              <button
                onClick={onNext}
                disabled={!allAnswered}
                className="flex-1 py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-40"
              >
                Avanti →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
