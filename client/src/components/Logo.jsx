import { RESTAURANT } from '@/lib/restaurant';
import { cx } from './ui';

/**
 * Mot-symbole du restaurant. Deux fichiers : cuivre sur fond clair,
 * sable sur fond sombre. Remplacer les PNG dans client/public/ suffit
 * a changer le logo partout.
 *
 * Le logo se dimensionne par sa LARGEUR : ses lettres sont fines et tres
 * etirees, une contrainte en hauteur les rend illisibles.
 */
export function Logo({ className, width = 180 }) {
  return (
    <picture className={cx('inline-block', className)}>
      <source srcSet="/logo-hasdrubal-light.png" media="(prefers-color-scheme: dark)" />
      <img
        src="/logo-hasdrubal.png"
        alt={RESTAURANT.fullName}
        style={{ width, height: 'auto' }}
        className="block max-w-full"
      />
    </picture>
  );
}

/** Variante texte, pour les contextes ou l'image ne convient pas. */
export function Wordmark({ className }) {
  return (
    <span className={cx('display leading-none', className)}>
      <span className="block text-[var(--color-brand)] tracking-[0.08em] uppercase">
        {RESTAURANT.name}
      </span>
      <span className="mt-1 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
        De <span className="h-px flex-1 bg-[var(--color-border)]" /> Carthage
      </span>
    </span>
  );
}
