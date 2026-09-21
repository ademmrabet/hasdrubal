/**
 * Animations GSAP. Regle de conduite : l'interface reste utilisable sans elles,
 * elles ne font qu'accompagner l'apparition du contenu. Tout est desactive si
 * l'utilisateur a demande a reduire les animations.
 */
import { gsap } from 'gsap';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Fait apparaitre en cascade les enfants marques .gsap-reveal dans un conteneur. */
export function revealChildren(container, { selector = '.gsap-reveal', y = 14, stagger = 0.05, delay = 0 } = {}) {
  if (!container) return () => {};
  const targets = container.querySelectorAll(selector);
  if (!targets.length) return () => {};

  if (prefersReduced()) {
    gsap.set(targets, { opacity: 1, y: 0 });
    return () => {};
  }

  const tween = gsap.fromTo(
    targets,
    { opacity: 0, y },
    { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger, delay, clearProps: 'transform' },
  );
  return () => tween.kill();
}

/** Compteur anime sur un indicateur chiffre. onUpdate recoit la valeur courante. */
export function animateNumber(from, to, onUpdate, duration = 0.7) {
  if (prefersReduced() || from === to) {
    onUpdate(to);
    return () => {};
  }
  const proxy = { value: from };
  const tween = gsap.to(proxy, {
    value: to,
    duration,
    ease: 'power2.out',
    onUpdate: () => onUpdate(proxy.value),
  });
  return () => tween.kill();
}

/** Ouverture d'un panneau lateral ou d'une boite de dialogue. */
export function enterPanel(element, { from = 'right' } = {}) {
  if (!element || prefersReduced()) return () => {};
  const offset = from === 'right' ? { x: 24 } : { y: 16 };
  const tween = gsap.fromTo(
    element,
    { opacity: 0, ...offset },
    { opacity: 1, x: 0, y: 0, duration: 0.3, ease: 'power3.out' },
  );
  return () => tween.kill();
}

/** Secousse courte pour signaler une erreur de saisie. */
export function shake(element) {
  if (!element || prefersReduced()) return;
  gsap.fromTo(element, { x: -6 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.35)' });
}

export { gsap };
