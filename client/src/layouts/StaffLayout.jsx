import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, ClipboardList, LogOut, PackagePlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { revealChildren } from '@/lib/animations';
import { Logo } from '@/components/Logo';
import { cx } from '@/components/ui';

/**
 * Interface de service : pensee pour une tablette en cuisine.
 * Peu d'ecrans, grandes zones tactiles, navigation en bas de l'ecran.
 */
const NAV = [
  { to: '/service', end: true, label: 'Ma journée', icon: ClipboardList },
  { to: '/service/carte', label: 'Carte', icon: BookOpen },
  { to: '/service/stock', label: 'Stock', icon: PackagePlus },
];

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => revealChildren(mainRef.current, { y: 10 }), [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <div>
          <Logo width={140} />
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{user?.fullName}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)]"
        >
          <LogOut size={16} /> Quitter
        </button>
      </header>

      <main ref={mainRef} className="flex-1 p-4 pb-24 max-w-3xl w-full mx-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] grid grid-cols-3">
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx(
              'flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-faint)]',
            )}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
