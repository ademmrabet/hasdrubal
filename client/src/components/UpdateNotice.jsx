import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { enterPanel } from '@/lib/animations';

const CHECK_EVERY_MS = 60 * 60 * 1000;   // verifie une nouvelle version chaque heure
const IDLE_MS = 5 * 60 * 1000;           // applique seule apres 5 min sans interaction

/**
 * Mise a jour automatique de l'application sur tablettes et telephones.
 *
 * Une nouvelle version n'est jamais appliquee en pleine saisie. Elle s'installe :
 * - quand l'ecran passe en arriere-plan (onglet change, appareil mis en veille),
 * - apres 5 minutes sans toucher l'ecran,
 * - ou tout de suite si l'utilisateur touche "Mettre a jour".
 */
export default function UpdateNotice() {
  const panelRef = useRef(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update().catch(() => {}), CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return undefined;
    const cleanupAnim = enterPanel(panelRef.current, { from: 'bottom' });

    const apply = () => updateServiceWorker(true);
    let idleTimer = setTimeout(apply, IDLE_MS);
    const onActivity = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(apply, IDLE_MS);
    };
    const onHidden = () => { if (document.visibilityState === 'hidden') apply(); };

    const events = ['pointerdown', 'keydown', 'input'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      cleanupAnim();
      clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh) return null;

  return (
    <div
      ref={panelRef}
      role="status"
      className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-lg sm:bottom-6"
    >
      <RefreshCw size={18} className="shrink-0 text-[var(--color-brand)]" />
      <p className="flex-1 text-sm">Une nouvelle version de l'application est prête.</p>
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-[var(--radius-control)] bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-brand-strong)]"
      >
        Mettre à jour
      </button>
    </div>
  );
}
