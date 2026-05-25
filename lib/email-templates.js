// lib/email-templates.js — 7 template HTML email ES Work
// Colori: verde #16a34a, dark #2C3E50, font Arial

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://eswork-app.vercel.app';

// ─── Wrapper HTML base ────────────────────────────────────────────────────────

function wrapTemplate(content) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ES Work</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <tr>
        <td style="background:#2C3E50;padding:24px 32px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">ES</span>
                <span style="font-size:22px;font-weight:800;color:#16a34a;letter-spacing:-0.5px;"> Work</span>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;">by Essentia Salutis</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="padding:32px;">
          ${content}
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
            <strong style="color:#2C3E50;">Essentia Salutis</strong><br>
            Email: <a href="mailto:info@essentiasalutis.it" style="color:#16a34a;">info@essentiasalutis.it</a><br>
            Web: <a href="https://essentiasalutis.it" style="color:#16a34a;">essentiasalutis.it</a>
          </p>
          <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;">
            Questa comunicazione è riservata al destinatario. I dati personali sono trattati secondo il Reg. UE 2016/679 (GDPR).
            Per non ricevere ulteriori comunicazioni scrivi a <a href="mailto:privacy@essentiasalutis.it" style="color:#94a3b8;">privacy@essentiasalutis.it</a>.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ctaButton(text, url) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:#16a34a;border-radius:10px;padding:0;">
        <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${text} →</a>
      </td>
    </tr>
  </table>`;
}

function infoBox(text) {
  return `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:#166534;">${text}</div>`;
}

// ─── 1. invite_assessment ────────────────────────────────────────────────────

export function inviteAssessment({ employee_name, company_name, assessment_link }) {
  const firstName = (employee_name || '').split(' ')[0];
  return wrapTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#2C3E50;">Ciao ${firstName}! 👋</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      <strong>${company_name}</strong> ha aderito al programma <strong>ES Work</strong> per il benessere dei dipendenti.<br>
      Ti invitiamo a compilare un breve questionario sul tuo benessere fisico.
    </p>
    ${infoBox(`⏱️ <strong>Meno di 5 minuti</strong> · 🔒 Riservato e anonimo · 📱 Puoi farlo da smartphone`)}
    <p style="font-size:14px;color:#475569;line-height:1.6;">
      Le risposte sono <strong>completamente anonime</strong>: il tuo datore di lavoro non vedrà mai i tuoi dati individuali. I risultati vengono elaborati solo in forma aggregata.
    </p>
    ${ctaButton('Compila il questionario', assessment_link)}
    <p style="font-size:13px;color:#94a3b8;">
      Se il pulsante non funziona, copia questo link nel browser:<br>
      <a href="${assessment_link}" style="color:#16a34a;word-break:break-all;">${assessment_link}</a>
    </p>
  `);
}

// ─── 2. reminder_assessment ──────────────────────────────────────────────────

export function reminderAssessment({ employee_name, company_name, assessment_link, days_remaining }) {
  const firstName = (employee_name || '').split(' ')[0];
  const urgency = days_remaining <= 3 ? '🚨 Ultimi giorni!' : '⏰ Promemoria';
  return wrapTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#2C3E50;">${urgency}</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Ciao ${firstName}, ti ricordiamo che <strong>${company_name}</strong> ti ha invitato a compilare il questionario ES Work.
    </p>
    ${days_remaining > 0
      ? infoBox(`Mancano ancora <strong>${days_remaining} giorni</strong> per completarlo. Bastano meno di 5 minuti!`)
      : `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:#dc2626;">La campagna assessment è quasi chiusa. Completa subito il questionario!</div>`
    }
    ${ctaButton('Compila il questionario', assessment_link)}
    <p style="font-size:13px;color:#94a3b8;">
      Link diretto: <a href="${assessment_link}" style="color:#16a34a;">${assessment_link}</a>
    </p>
  `);
}

// ─── 3. outcome_l1 ───────────────────────────────────────────────────────────

export function outcomeL1({ employee_name, company_name }) {
  const firstName = (employee_name || '').split(' ')[0];
  return wrapTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#2C3E50;">Il tuo profilo è pronto ✅</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Ciao ${firstName}, grazie per aver completato il questionario ES Work per <strong>${company_name}</strong>.
    </p>
    ${infoBox(`🌿 <strong>Sei stato selezionato</strong> per partecipare al protocollo di trattamento osteopatico personalizzato.`)}
    <p style="font-size:14px;color:#475569;line-height:1.6;">
      Sarai contattato dal nostro coordinatore per fissare una breve <strong>pre-validazione clinica</strong> (videocall di circa 20 minuti) che confermerà il programma più adatto a te.
    </p>
    <p style="font-size:14px;color:#475569;line-height:1.6;">
      Non devi fare nulla: aspetta la nostra chiamata o email.
    </p>
    <p style="font-size:13px;color:#64748b;margin-top:24px;">
      Per informazioni: <a href="mailto:info@essentiasalutis.it" style="color:#16a34a;">info@essentiasalutis.it</a>
    </p>
  `);
}

// ─── 4. outcome_l2 ───────────────────────────────────────────────────────────

export function outcomeL2({ employee_name, company_name }) {
  const firstName = (employee_name || '').split(' ')[0];
  return wrapTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#2C3E50;">Il tuo profilo è pronto ✅</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Ciao ${firstName}, grazie per aver completato il questionario ES Work per <strong>${company_name}</strong>.
    </p>
    ${infoBox(`📊 Il tuo profilo indica <strong>segnali precoci</strong> da monitorare. Sarai incluso nel programma di monitoraggio periodico.`)}
    <p style="font-size:14px;color:#475569;line-height:1.6;">
      Riceverai un invito al <strong>mini-check</strong> nei prossimi mesi per monitorare il tuo benessere. Potrai in qualsiasi momento segnalare un dolore acuto tramite la tua area personale.
    </p>
    <p style="font-size:13px;color:#64748b;margin-top:24px;">
      Per informazioni: <a href="mailto:info@essentiasalutis.it" style="color:#16a34a;">info@essentiasalutis.it</a>
    </p>
  `);
}

// ─── 5. outcome_l3 ───────────────────────────────────────────────────────────

export function outcomeL3({ employee_name, company_name }) {
  const firstName = (employee_name || '').split(' ')[0];
  return wrapTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#2C3E50;">Il tuo profilo è pronto ✅</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Ciao ${firstName}, grazie per aver completato il questionario ES Work per <strong>${company_name}</strong>.
    </p>
    ${infoBox(`✨ Ottimo! Il tuo profilo indica <strong>buona salute muscolo-scheletrica</strong>. Parteciperai al programma di formazione e prevenzione.`)}
    <p style="font-size:14px;color:#475569;line-height:1.6;">
      Riceverai aggiornamenti su attività formative e di prevenzione organizzate da <strong>${company_name}</strong> con ES Work.
    </p>
    <p style="font-size:13px;color:#64748b;margin-top:24px;">
      Per informazioni: <a href="mailto:info@essentiasalutis.it" style="color:#16a34a;">info@essentiasalutis.it</a>
    </p>
  `);
}

// ─── 6. minicheck_invite ─────────────────────────────────────────────────────

export function minicheckInvite({ employee_name, company_name, minicheck_link, checkpoint }) {
  const firstName = (employee_name || '').split(' ')[0];
  const checkLabel = checkpoint === 't6' ? 'T6 (6 mesi)' : 'T3 (3 mesi)';
  return wrapTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#2C3E50;">Mini-check ${checkLabel} 📋</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Ciao ${firstName}, è arrivato il momento del check periodico ES Work per <strong>${company_name}</strong>.
    </p>
    ${infoBox(`⏱️ <strong>Solo 1 minuto</strong> · 3 domande sul tuo benessere attuale`)}
    <p style="font-size:14px;color:#475569;line-height:1.6;">
      Questo breve check ci aiuta a monitorare la tua salute nel tempo e a intervenire tempestivamente se necessario.
    </p>
    ${ctaButton('Compila il mini-check', minicheck_link)}
    <p style="font-size:13px;color:#94a3b8;">
      Link diretto: <a href="${minicheck_link}" style="color:#16a34a;">${minicheck_link}</a>
    </p>
  `);
}

// ─── 7. acute_event_osteopath ────────────────────────────────────────────────

export function acuteEventOsteopath({ patient_name, company_name, description, nrs, zone, deadline }) {
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })
    : 'entro 24 ore';

  return wrapTemplate(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#dc2626;">🚨 Evento acuto segnalato</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
      Un tuo paziente ha segnalato un evento acuto. <strong>Contatta il paziente entro le scadenze indicate.</strong>
    </p>
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:20px;margin:16px 0;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:120px;">Paziente</td><td style="font-size:14px;font-weight:600;color:#0f172a;">${patient_name}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Azienda</td><td style="font-size:14px;color:#0f172a;">${company_name}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Zona</td><td style="font-size:14px;color:#0f172a;">${zone || 'Non specificata'}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">NRS</td><td style="font-size:14px;font-weight:700;color:#dc2626;">${nrs != null ? `${nrs}/10` : 'n.d.'}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Descrizione</td><td style="font-size:14px;color:#0f172a;">${description || '—'}</td></tr>
      </table>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin:16px 0;font-size:13px;color:#9a3412;">
      ⏰ <strong>Scadenza contatto:</strong> ${deadlineStr}.<br>
      Se non riesci a contattare il paziente entro questa data, l'admin riceverà un alert di escalation.
    </div>
    <p style="font-size:13px;color:#64748b;">
      Accedi alla tua area per gestire questo evento: <a href="${BASE_URL}/osteopath/dashboard" style="color:#16a34a;">${BASE_URL}/osteopath/dashboard</a>
    </p>
  `);
}

// ─── Mappa template per nome ─────────────────────────────────────────────────

export const TEMPLATES = {
  invite_assessment: inviteAssessment,
  reminder_assessment: reminderAssessment,
  outcome_l1: outcomeL1,
  outcome_l2: outcomeL2,
  outcome_l3: outcomeL3,
  minicheck_invite: minicheckInvite,
  acute_event_osteopath: acuteEventOsteopath,
};

export function renderTemplate(name, vars) {
  const fn = TEMPLATES[name];
  if (!fn) throw new Error(`Template "${name}" non trovato`);
  return fn(vars);
}
