import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeftRight, BookOpen, LayoutDashboard, LogOut, Menu, Package,
  Truck, Users as UsersIcon, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useAlerts } from '@/api/hooks';
import { ROLE_LABELS } from '@/lib/format';
import { revealChildren } from '@/lib/animations';
import { RESTAURANT } from '@/lib/restaurant';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge, cx } from '@/components/ui';

const NAV = [
  { to: '/admin', end: true, label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/admin/carte', label: 'La carte', icon: BookOpen },
  { to: '/admin/ingredients', label: 'Stock', icon: Package },
  { to: '/admin/mouvements', label: 'Mouvements', icon: ArrowLeftRight },
  { to: '/admin/alertes', label: 'Alertes', icon: AlertTriangle, badge: 'alerts' },
  { to: '/admin/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: UsersIcon, ownerOnly: true },
];

export default function AdminLayout() {
  const { user, logout, isOwner } = useAuth();
  const { data: alerts } = useAlerts();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef(null);

  const alertCount = (alerts?.data?.lowStock?.length ?? 0) + (alerts?.data?.expiring?.length ?? 0);

  // Chaque changement de page rejoue l'apparition du contenu.
  useEffect(() => revealChildren(mainRef.current, { y: 10 }), [location.pathname]);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const items = NAV.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      {/* Barre laterale */}
      <aside
        className={cx(
          'bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col',
          'fixed inset-y-0 left-0 z-40 w-[250px] transition-transform lg:static lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="px-4 py-5 border-b border-[var(--color-border)]">
          <Logo width={168} />
          <p className="mt-2 text-[0.65rem] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
            Système de gestion
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map(({ to, end, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cx(
                'flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)] font-medium'
                  : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)]',
              )}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {badge === 'alerts' && alertCount > 0 && <Badge tone="danger">{alertCount}</Badge>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[var(--color-border)] p-3">
          <p className="px-1 pb-2 text-[0.65rem] text-[var(--color-ink-faint)] truncate">
            {RESTAURANT.address}
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="px-1 text-sm font-medium truncate">{user?.fullName}</p>
              <p className="px-1 text-xs text-[var(--color-ink-faint)]">{ROLE_LABELS[user?.role]}</p>
            </div>
            <ThemeToggle />
          </div>
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)]"
          >
            <LogOut size={16} /> Se déconnecter
          </button>
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 lg:hidden">
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" className="rounded p-1">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Logo width={130} />
          <ThemeToggle className="ml-auto" />
        </header>

        <main ref={mainRef} className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
