import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Clienti', icon: '🏢', color: 'gray' },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: '📊', color: 'purple' },
  { href: '/dashboard/professionals', label: 'Professionisti', icon: '👨‍⚕️', color: 'indigo' },
  { href: '/dashboard/professional-compliance', label: 'Conformità prof.', icon: '🛡️', color: 'rose' },
  { href: '/dashboard/pro-document-log', label: 'Log documenti prof.', icon: '📁', color: 'slate' },
  { href: '/dashboard/referrals', label: 'Referral B2C', icon: '🔗', color: 'orange' },
  { href: '/dashboard/compliance', label: 'Compliance', icon: '✅', color: 'teal' },
  { href: '/dashboard/access-logs', label: 'Registro accessi', icon: '🔒', color: 'slate' },
  { href: '/dashboard/data-requests', label: 'Richieste GDPR', icon: '🔐', color: 'violet' },
  { href: '/dashboard/retention', label: 'Conservazione dati', icon: '🗄️', color: 'amber' },
  { href: '/dashboard/restratifications', label: 'Ri-stratificazioni', icon: '🔄', color: 'rose' },
  { href: '/dashboard/acute-events', label: 'Eventi acuti (storico)', icon: '🗄️', color: 'red', badge: true },
  { href: '/dashboard/finance', label: 'Finance', icon: '💶', color: 'emerald' },
  { href: '/dashboard/pricing-v2', label: 'Listino v2', icon: '🏷️', color: 'green' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️', color: 'gray' },
];

export default function NavMenu({ pendingAcuteCount = 0, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const router = useRouter();

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
        {/* Red dot if pending acute events */}
        {pendingAcuteCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {pendingAcuteCount > 9 ? '9+' : pendingAcuteCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
          <div className="px-3 pb-2 mb-1 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Navigazione</span>
          </div>
          {NAV_ITEMS.map(item => {
            const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative
                  ${isActive
                    ? 'bg-gray-50 text-gray-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && pendingAcuteCount > 0 && (
                  <span className="w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingAcuteCount > 9 ? '9+' : pendingAcuteCount}
                  </span>
                )}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                )}
              </Link>
            );
          })}
          <div className="px-3 pt-2 mt-1 border-t border-gray-100">
            <button
              onClick={() => { setOpen(false); onLogout?.(); }}
              className="w-full text-left flex items-center gap-3 px-1 py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              <span className="text-base w-5 text-center">🚪</span>
              <span>Esci</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
