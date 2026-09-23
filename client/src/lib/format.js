/**
 * Les montants circulent en millimes (entiers). 1 DT = 1000 millimes.
 * Tout le formatage passe par ici pour garder un affichage coherent.
 */

const nf = (min, max) => new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: min,
  maximumFractionDigits: max,
});

/** 38500 -> "38,500 DT" */
export function formatTND(millimes, { withSymbol = true, compact = false } = {}) {
  if (millimes == null || Number.isNaN(Number(millimes))) return '—';
  const dinars = Number(millimes) / 1000;

  if (compact && Math.abs(dinars) >= 1000) {
    return `${nf(1, 1).format(dinars / 1000)} k${withSymbol ? ' DT' : ''}`;
  }
  return `${nf(3, 3).format(dinars)}${withSymbol ? ' DT' : ''}`;
}

/** Saisie utilisateur en dinars -> millimes entiers. */
export const toMillimes = (dinars) => Math.round(Number(dinars || 0) * 1000);
export const toDinars = (millimes) => Number(millimes || 0) / 1000;

/** Quantites : 3 decimales max, sans zeros inutiles. */
export function formatQty(value, unit) {
  if (value == null) return '—';
  const text = nf(0, 3).format(Number(value));
  return unit ? `${text} ${unit}` : text;
}

export function formatDate(value, style = 'short') {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-TN', {
    dateStyle: style,
    timeZone: 'Africa/Tunis',
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-TN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Tunis',
  }).format(new Date(value));
}

/** "il y a 3 jours" */
export function formatRelative(value) {
  if (!value) return '—';
  const diffMs = new Date(value).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const units = [['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000]];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'minute') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return "à l'instant";
}

export const UNIT_LABELS = {
  kg: 'kilogramme', g: 'gramme', l: 'litre', ml: 'millilitre',
  piece: 'pièce', botte: 'botte', boite: 'boîte', bouteille: 'bouteille',
};

export const ROLE_LABELS = { owner: 'Propriétaire', manager: 'Responsable', staff: 'Équipe' };

export const MOVEMENT_LABELS = {
  entree: 'Entrée', sortie: 'Sortie', perte: 'Perte', ajustement: 'Ajustement',
};

export const STATUS_LABELS = { ok: 'Normal', bas: 'Stock bas', rupture: 'Rupture' };

// --- Paie ---------------------------------------------------------------

export const CONTRACT_TYPE_LABELS = { cdi: 'CDI', cdd: 'CDD', stage: 'Stage', autre: 'Autre' };

export const PAYSLIP_STATUS_LABELS = { brouillon: 'Brouillon', validee: 'Validée', payee: 'Payée' };

/** "2026-01-15" -> "janvier 2026" (mois de la periode de paie) */
export function formatMonthLabel(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  const label = new Intl.DateTimeFormat('fr-TN', { month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "2026-01" (valeur d'un <input type="month">) -> { periodStart, periodEnd } du mois calendaire. */
export function monthToPeriod(monthValue) {
  const [year, month] = monthValue.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const iso = (d) => d.toISOString().slice(0, 10);
  return { periodStart: iso(start), periodEnd: iso(end) };
}

// --- Menu -------------------------------------------------------------

/**
 * Ratio matiere (cout matiere / prix HT). Reperes usuels en restauration :
 * sous 30 % confortable, 30 a 38 % a surveiller, au-dela la marge souffre.
 * Ajustables ici.
 */
export const FOOD_COST_TARGETS = { ok: 30, warn: 38 };

export function foodCostTone(pct) {
  if (pct == null) return 'neutral';
  if (pct <= FOOD_COST_TARGETS.ok) return 'ok';
  if (pct <= FOOD_COST_TARGETS.warn) return 'warn';
  return 'danger';
}

export const formatPct = (value) =>
  value == null ? '—' : `${new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 1 }).format(value)} %`;

export const ALLERGEN_LABELS = {
  gluten: 'Gluten', crustaces: 'Crustacés', oeufs: 'Œufs', poisson: 'Poisson',
  arachides: 'Arachides', soja: 'Soja', lait: 'Lait', 'fruits a coque': 'Fruits à coque',
  celeri: 'Céleri', moutarde: 'Moutarde', sesame: 'Sésame', sulfites: 'Sulfites',
  lupin: 'Lupin', mollusques: 'Mollusques',
};

export const TAG_LABELS = {
  signature: 'Signature', classique: 'Classique', vegetarien: 'Végétarien', epice: 'Épicé',
};

/** Prix de menu : "48 DT" si rond, "12,500 DT" sinon. */
export function formatMenuPrice(millimes) {
  if (millimes == null) return '';
  const dinars = Number(millimes) / 1000;
  const whole = Number.isInteger(dinars);
  return `${new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: whole ? 0 : 3, maximumFractionDigits: 3,
  }).format(dinars)} DT`;
}
