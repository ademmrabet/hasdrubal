import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { animateNumber, enterPanel, revealChildren } from '@/lib/animations';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */
const BUTTON_VARIANTS = {
  primary: 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-strong)]',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]',
  ghost: 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)]',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
};

export function Button({ variant = 'primary', loading, className, children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2',
        'text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_VARIANTS[variant], className,
      )}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Conteneurs                                                          */
/* ------------------------------------------------------------------ */
export function Card({ className, children, ...props }) {
  return <div {...props} className={cx('card p-4', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Conteneur qui fait apparaitre ses enfants .gsap-reveal en cascade. */
export function Reveal({ children, className, deps = [] }) {
  const ref = useRef(null);
  useEffect(() => revealChildren(ref.current), deps); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className={className}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */
const TONES = {
  neutral: 'text-[var(--color-ink)]',
  ok: 'text-[var(--color-ok)]',
  warn: 'text-[var(--color-warn)]',
  danger: 'text-[var(--color-danger)]',
};

/** Indicateur chiffre. `format` recoit la valeur animee et rend le texte final. */
export function StatCard({ label, value, format = (v) => Math.round(v), hint, tone = 'neutral', icon: Icon }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => animateNumber(0, Number(value) || 0, setDisplay), [value]);

  return (
    <Card className="gsap-reveal">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</span>
        {Icon && <Icon size={16} className="text-[var(--color-ink-faint)] shrink-0" />}
      </div>
      <p className={cx('mt-2 text-2xl font-semibold tabular', TONES[tone])}>{format(display)}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{hint}</p>}
    </Card>
  );
}

const BADGE_TONES = {
  neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-ink-soft)]',
  ok: 'bg-[var(--color-ok-soft)] text-[var(--color-ok)]',
  warn: 'bg-[var(--color-warn-soft)] text-[var(--color-warn)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
};

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaire                                                          */
/* ------------------------------------------------------------------ */
export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error
        ? <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>
        : hint && <span className="mt-1 block text-xs text-[var(--color-ink-faint)]">{hint}</span>}
    </label>
  );
}

export const Input = (props) => <input {...props} className={cx('input', props.className)} />;
export const Select = ({ children, ...props }) => (
  <select {...props} className={cx('input', props.className)}>{children}</select>
);

/* ------------------------------------------------------------------ */
/* Tableau                                                             */
/* ------------------------------------------------------------------ */
/**
 * `selection` est optionnel : { selectedIds: Set, onToggle(id), onToggleAll() }.
 * Sans lui le tableau se comporte exactement comme avant (aucune case a cocher).
 */
export function Table({ columns, rows, keyField = 'id', empty = 'Aucune donnée', onRowClick, selection }) {
  if (!rows?.length) return <EmptyState message={empty} />;

  const allSelected = selection ? rows.every((row) => selection.selectedIds.has(row[keyField])) : false;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {selection && (
              <th className="py-2.5 px-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={allSelected}
                  onChange={selection.onToggleAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cx(
                  'py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]',
                  col.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const checked = selection?.selectedIds.has(row[keyField]);
            return (
              <tr
                key={row[keyField]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx(
                  'border-b border-[var(--color-border)] last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-[var(--color-surface-muted)]',
                  checked && 'bg-[var(--color-surface-muted)]',
                )}
              >
                {selection && (
                  <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Sélectionner"
                      checked={!!checked}
                      onChange={() => selection.onToggle(row[keyField])}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={cx('py-2.5 px-3', col.align === 'right' && 'text-right tabular')}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-[var(--color-ink-soft)]">{message}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Chargement...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-ink-soft)]">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <p className="rounded-[var(--radius-control)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Boite de dialogue                                                   */
/* ------------------------------------------------------------------ */
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const cleanup = enterPanel(panelRef.current, { from: 'bottom' });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      cleanup();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('relative w-full card p-0 max-h-[92vh] overflow-y-auto', width)}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded p-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)]">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Graphique : barres verticales, lisible sans couleur                 */
/* ------------------------------------------------------------------ */
export function BarChart({ data, height = 150, formatValue = (v) => v, formatLabel = (l) => l }) {
  const max = Math.max(...data.map((d) => Math.max(d.primary ?? 0, d.secondary ?? 0)), 1);

  return (
    <div className="w-full" role="img" aria-label="Évolution sur la période">
      <div className="flex items-stretch gap-1.5" style={{ height }}>
        {data.map((point, index) => (
          <div key={point.label ?? index} className="flex-1 h-full flex flex-col justify-end gap-0.5 group relative">
            <div
              className="w-full rounded-t bg-[var(--color-brand)] transition-all"
              style={{ height: `${((point.primary ?? 0) / max) * 100}%`, minHeight: point.primary ? 2 : 0 }}
            />
            <div
              className="w-full rounded-t bg-[var(--color-accent)] opacity-70"
              style={{ height: `${((point.secondary ?? 0) / max) * 100}%`, minHeight: point.secondary ? 2 : 0 }}
            />
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--color-ink)] px-2 py-1 text-[11px] text-[var(--color-surface)] opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {formatLabel(point.label)} · {formatValue(point.primary ?? 0)} / {formatValue(point.secondary ?? 0)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-[var(--color-ink-soft)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[var(--color-brand)]" /> Entrées
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[var(--color-accent)] opacity-70" /> Sorties et pertes
        </span>
      </div>
    </div>
  );
}
