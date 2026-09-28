import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// Menu raggruppato e compatto (Enrico, 28/9: «troppo lungo, deve vedersi tutto»).
// Tolta «Referral B2C»: 1 codice, 0 utilizzi in piattaforma; la pagina resta, e ci si
// arriva dalla scheda azienda («Tutti →»).
const NAV_GROUPS = [
  { titolo: 'Lavoro', voci: [
    { href: '/dashboard', label: 'Clienti', icon: '🏢' },
    { href: '/dashboard/pipeline', label: 'Pipeline', icon: '📊' },
    { href: '/dashboard/comunicazioni', label: 'Comunicazioni', icon: '✉️', badgeComunicazioni: true },
    { href: '/dashboard/sportello', label: 'Sportello', icon: '🗓' },
    { href: '/dashboard/restratifications', label: 'Ri-stratificazioni', icon: '🔄' },
    { href: '/dashboard/demo-permanente', label: 'Demo convegni', icon: '🎤' },
  ] },
  { titolo: 'Professionisti', voci: [
    { href: '/dashboard/professionals', label: 'Professionisti', icon: '👨‍⚕️' },
    { href: '/dashboard/professional-compliance', label: 'Conformità prof.', icon: '🛡️' },
    { href: '/dashboard/medici-competenti', label: 'Medici competenti', icon: '🩺' },
  ] },
  { titolo: 'Economia', voci: [
    { href: '/dashboard/finance', label: 'Finance', icon: '💶' },
    { href: '/dashboard/pricing-v2', label: 'Listino v2', icon: '🏷️' },
  ] },
  { titolo: 'Privacy e registri', voci: [
    { href: '/dashboard/compliance', label: 'Compliance', icon: '✅' },
    { href: '/dashboard/access-logs', label: 'Registro accessi', icon: '🔒' },
    { href: '/dashboard/pro-document-log', label: 'Log documenti prof.', icon: '📁' },
    { href: '/dashboard/data-requests', label: 'Richieste GDPR', icon: '🔐' },
    { href: '/dashboard/retention', label: 'Conservazione dati', icon: '🗄️' },
  ] },
];

export default function NavMenu({ onLogout }) {
  const [open, setOpen] = useState(false);
  const [nonLette, setNonLette] = useState(0);
  const ref = useRef(null);
  const router = useRouter();

  // Messaggi dalle aziende non ancora letti: il menu lo chiede da solo, così il
  // contatore compare su ogni pagina della dashboard senza toccarle una per una.
  useEffect(() => {
    const aggiorna = () => fetch('/api/admin/comunicazioni?solo=conteggio')
      .then(r => (r.ok ? r.json() : null)).then(j => { if (j && Number.isFinite(j.nonLette)) setNonLette(j.nonLette); })
      .catch(() => {});
    aggiorna();
    // La pagina Comunicazioni avvisa quando si legge un messaggio: il pallino si
    // aggiorna subito, senza aspettare il cambio di pagina.
    window.addEventListener('comunicazioni:aggiornate', aggiorna);
    return () => window.removeEventListener('comunicazioni:aggiornate', aggiorna);
  }, [router.pathname]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [router.pathname]);

  const currentPath = router.pathname;

  return (
    <div className="relative" ref={ref}>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        aria-label="Menu"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
        {nonLette > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {nonLette > 9 ? '9+' : nonLette}
          </span>
        )}
      </button>

      {/* Dropdown: gruppi compatti, due colonne sugli schermi larghi, scorre se serve */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 md:w-[30rem] max-h-[calc(100vh-5rem)] overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50">
          <div className="md:grid md:grid-cols-2 md:gap-x-2">
            {NAV_GROUPS.map(gruppo => (
              <div key={gruppo.titolo} className="mb-1.5">
                <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{gruppo.titolo}</div>
                {gruppo.voci.map(item => {
                  const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[13px] leading-5 transition-colors
                        ${isActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                      <span className="text-sm w-5 text-center flex-shrink-0">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badgeComunicazioni && nonLette > 0 && (
                        <span className="min-w-[1.1rem] h-[1.1rem] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {nonLette > 9 ? '9+' : nonLette}
                        </span>
                      )}
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); onLogout?.(); }}
              className="w-full text-left flex items-center gap-2 px-2 py-1 rounded-lg text-[13px] text-red-600 hover:bg-red-50 transition-colors"
            >
              <span className="text-sm w-5 text-center">🚪</span>
              <span>Esci</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
