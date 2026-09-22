import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Instagram, MapPin, Phone } from 'lucide-react';
import { usePublicMenu } from '@/api/hooks';
import { ALLERGEN_LABELS, formatMenuPrice } from '@/lib/format';
import { RESTAURANT } from '@/lib/restaurant';
import { revealChildren } from '@/lib/animations';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Spinner, cx } from '@/components/ui';

const DAYS = [
  ['monday', 'Lundi'], ['tuesday', 'Mardi'], ['wednesday', 'Mercredi'], ['thursday', 'Jeudi'],
  ['friday', 'Vendredi'], ['saturday', 'Samedi'], ['sunday', 'Dimanche'],
];

/** Ouvert en ce moment ? Calcule a l'heure de Tunis, pas celle du telephone. */
function openStatus(hours) {
  if (!hours) return null;
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Africa/Tunis' }).format(now).toLowerCase();
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Tunis' }).format(now);
  const today = hours[day];
  if (!today) return { open: false, label: "Fermé aujourd'hui" };
  if (time < today.open) return { open: false, label: `Ouvre à ${today.open.replace(':', 'h')}` };
  if (time >= today.close) return { open: false, label: 'Fermé pour ce soir' };
  return { open: true, label: `Ouvert jusqu'à ${today.close.replace(':', 'h')}` };
}

export default function PublicMenu() {
  const { data, isLoading, error, fetchStatus } = usePublicMenu();
  // Sans reseau, TanStack Query met la requete en pause au lieu d'echouer.
  const offline = isLoading && fetchStatus === 'paused';
  const [activeId, setActiveId] = useState(null);
  const listRef = useRef(null);
  const tabsRef = useRef(null);

  const menu = data?.data;
  const restaurant = { ...RESTAURANT, ...(menu?.restaurant ?? {}) };
  const categories = menu?.categories ?? [];
  const status = useMemo(() => openStatus(menu?.openingHours), [menu]);

  useEffect(() => { document.title = `La carte — ${restaurant.fullName}`; }, [restaurant.fullName]);
  useEffect(() => revealChildren(listRef.current, { y: 18, stagger: 0.04 }), [categories.length]);

  // Onglet actif = la categorie visible a l'ecran.
  useEffect(() => {
    if (!categories.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id.replace('cat-', ''));
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories]);

  // Garde l'onglet actif visible dans la barre defilante.
  useEffect(() => {
    tabsRef.current?.querySelector(`[data-id="${activeId}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const jumpTo = (id) => {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* ------------------------------------------------ En-tete */}
      <header className="relative overflow-hidden bg-[var(--color-hero)] px-5 pb-8 pt-10 text-center">
        <ThemeToggle className="absolute right-3 top-3 z-10 bg-[var(--color-surface)]/70" />
        <div aria-hidden className="absolute -bottom-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-t-full bg-[var(--color-surface)] opacity-40" />
        <div className="relative">
          <Logo width={230} className="mx-auto" />
          <p className="display mt-5 text-sm uppercase tracking-[0.3em] text-[var(--color-brand-strong)]">La carte</p>
          {status && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface)]/70 px-3 py-1 text-xs text-[var(--color-ink)]">
              <span className={cx('h-2 w-2 rounded-full', status.open ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-ink-faint)]')} />
              {status.label}
            </p>
          )}
        </div>
      </header>

      {isLoading && !offline && <Spinner label="Chargement de la carte..." />}
      {offline && (
        <p className="px-5 py-10 text-center text-sm text-[var(--color-ink-soft)]">
          Pas de connexion pour le moment. La carte s'affichera dès que le réseau reviendra.
        </p>
      )}
      {error && (
        <p className="px-5 py-10 text-center text-sm text-[var(--color-ink-soft)]">
          La carte n'a pas pu être chargée. Demandez-la à notre équipe, ou réessayez dans un instant.
        </p>
      )}

      {categories.length > 0 && (
        <>
          {/* ------------------------------------------ Onglets */}
          <nav
            ref={tabsRef}
            aria-label="Catégories"
            className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 py-2 backdrop-blur [scrollbar-width:none]"
          >
            {categories.map((c) => (
              <button
                key={c.id}
                data-id={c.id}
                onClick={() => jumpTo(c.id)}
                className={cx(
                  'shrink-0 rounded-full px-4 py-2 text-sm transition-colors',
                  activeId === c.id
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-ink-soft)] hover:text-[var(--color-brand)]',
                )}
              >
                {c.name}
              </button>
            ))}
          </nav>

          {/* ------------------------------------------ Plats */}
          <main ref={listRef} className="mx-auto max-w-2xl px-5 pb-10">
            {categories.map((category) => (
              <section key={category.id} id={`cat-${category.id}`} className="pt-9 scroll-mt-16">
                <div className="gsap-reveal mb-4 text-center">
                  <h2 className="text-2xl text-[var(--color-brand)]">{category.name}</h2>
                  {category.description && (
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">{category.description}</p>
                  )}
                  <div className="rule-brand mx-auto mt-3 w-24" />
                </div>

                <ul className="space-y-1">
                  {category.items.map((item) => <Dish key={item.id} item={item} />)}
                </ul>
              </section>
            ))}

            <p className="mt-10 rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] px-4 py-3 text-center text-xs leading-relaxed text-[var(--color-ink-soft)]">
              Prix en dinars tunisiens, taxes comprises. Une allergie ou une intolérance ? Parlez-en à notre équipe
              avant de commander.
            </p>
          </main>
        </>
      )}

      {/* ------------------------------------------------ Pied de page */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-5 py-8">
        <div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
          <div className="space-y-3 text-sm">
            <a href={`tel:${restaurant.phoneDial ?? restaurant.phone?.replace(/\s/g, '')}`}
               className="flex items-center gap-2 text-[var(--color-ink)] hover:text-[var(--color-brand)]">
              <Phone size={16} className="text-[var(--color-brand)]" /> {restaurant.phone}
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.fullName} ${restaurant.city ?? ''}`)}`}
              target="_blank" rel="noreferrer"
              className="flex items-start gap-2 text-[var(--color-ink)] hover:text-[var(--color-brand)]"
            >
              <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--color-brand)]" />
              <span>{restaurant.address}{restaurant.locatedIn ? ` — ${restaurant.locatedIn}` : ''}</span>
            </a>
            {restaurant.instagram && (
              <a href={`https://instagram.com/${restaurant.instagram}`} target="_blank" rel="noreferrer"
                 className="flex items-center gap-2 text-[var(--color-ink)] hover:text-[var(--color-brand)]">
                <Instagram size={16} className="text-[var(--color-brand)]" /> @{restaurant.instagram}
              </a>
            )}
          </div>

          {menu?.openingHours && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Clock size={16} className="text-[var(--color-brand)]" /> Horaires
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {DAYS.map(([key, label]) => {
                  const h = menu.openingHours[key];
                  return [
                    <dt key={`${key}-d`} className="text-[var(--color-ink-soft)]">{label}</dt>,
                    <dd key={`${key}-h`} className="text-right tabular">
                      {h ? `${h.open.replace(':', 'h')} – ${h.close.replace(':', 'h')}` : 'Fermé'}
                    </dd>,
                  ];
                })}
              </dl>
            </div>
          )}
        </div>
        <p className="mt-8 text-center text-[0.7rem] text-[var(--color-ink-faint)]">© {restaurant.fullName}</p>
      </footer>
    </div>
  );
}

function Dish({ item }) {
  const unavailable = !item.isAvailable;
  return (
    <li className={cx('gsap-reveal flex gap-4 border-b border-[var(--color-border)] py-4 last:border-0', unavailable && 'opacity-50')}>
      {item.imagePath && (
        <img
          src={item.imagePath}
          alt=""
          loading="lazy"
          className="h-20 w-20 shrink-0 rounded-[var(--radius-control)] object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className="font-medium leading-snug">
            {item.name}
            {item.isFeatured && (
              <span className="ml-2 align-middle text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-accent)]">
                Signature
              </span>
            )}
          </h3>
          <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-[var(--color-border)]" />
          <span className="shrink-0 font-medium tabular text-[var(--color-brand)]">
            {unavailable ? 'Épuisé' : formatMenuPrice(item.priceMillimes)}
          </span>
        </div>
        {item.description && <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{item.description}</p>}
        {item.allergens?.length > 0 && (
          <p className="mt-1.5 text-[0.7rem] text-[var(--color-ink-faint)]">
            Contient : {item.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(', ')}
          </p>
        )}
      </div>
    </li>
  );
}
