import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import {
  useDeleteMenuImage, useIngredients, useMenuItem, useMenuReference, useRemoveMenuItem,
  useSaveMenuItem, useUploadMenuImage,
} from '@/api/hooks';
import { errorMessage } from '@/api/client';
import {
  ALLERGEN_LABELS, foodCostTone, formatPct, formatTND, TAG_LABELS, toDinars, toMillimes,
} from '@/lib/format';
import { Badge, Button, ErrorNote, Field, Input, Modal, Select, Spinner, cx } from '@/components/ui';

const SUGGESTED_TAGS = Object.keys(TAG_LABELS);

/** Etat du formulaire a partir d'un plat existant, ou vierge. */
function toForm(item, defaults) {
  if (!item) {
    return {
      categoryId: defaults.categoryId ?? '', name: '', description: '', priceDinars: '',
      vatRate: 19, prepTimeMin: '', allergens: [], tags: [], isActive: true,
      isAvailable: true, isFeatured: false, sortOrder: 0, recipe: [],
    };
  }
  return {
    id: item.id, categoryId: item.categoryId, name: item.name, description: item.description ?? '',
    priceDinars: toDinars(item.priceMillimes), vatRate: Number(item.vatRate),
    prepTimeMin: item.prepTimeMin ?? '', allergens: item.allergens ?? [], tags: item.tags ?? [],
    isActive: item.isActive, isAvailable: item.isAvailable, isFeatured: item.isFeatured,
    sortOrder: item.sortOrder ?? 0, imagePath: item.imagePath,
    recipe: (item.recipe ?? []).map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity })),
  };
}

export default function MenuItemEditor({ itemId, categories, defaultCategoryId, onClose }) {
  const detail = useMenuItem(itemId);
  if (itemId && detail.isLoading) {
    return <Modal open onClose={onClose} title="Chargement..." width="max-w-4xl"><Spinner /></Modal>;
  }
  return (
    <EditorForm
      initial={toForm(itemId ? detail.data?.data : null, { categoryId: defaultCategoryId ?? categories[0]?.id })}
      categories={categories}
      onClose={onClose}
    />
  );
}

function EditorForm({ initial, categories, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const { data: ingredientsData } = useIngredients();
  const { data: reference } = useMenuReference();
  const save = useSaveMenuItem();
  const remove = useRemoveMenuItem();

  const ingredients = ingredientsData?.data ?? [];
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  // --- Calcul en direct : ce que le plat coute et rapporte ---------------
  const preview = useMemo(() => {
    const priceTtc = toMillimes(form.priceDinars);
    const priceHt = Math.round(priceTtc / (1 + Number(form.vatRate) / 100));
    const cost = Math.round(form.recipe.reduce((sum, line) => {
      const ing = byId.get(line.ingredientId);
      return sum + (ing ? Number(line.quantity || 0) * ing.avgCostMillimes : 0);
    }, 0));
    return { priceHt, cost, margin: priceHt - cost, pct: priceHt ? (cost * 100) / priceHt : null };
  }, [form.priceDinars, form.vatRate, form.recipe, byId]);

  const toggleIn = (key, value) => setForm((f) => ({
    ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
  }));

  const setLine = (index, patch) => setForm((f) => ({
    ...f, recipe: f.recipe.map((line, i) => (i === index ? { ...line, ...patch } : line)),
  }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const incomplete = form.recipe.some((l) => !l.ingredientId || !(Number(l.quantity) > 0));
    if (incomplete) return setError('Chaque ligne de la fiche technique doit avoir un ingrédient et une quantité.');

    try {
      await save.mutateAsync({
        id: form.id,
        categoryId: form.categoryId,
        name: form.name,
        description: form.description || null,
        priceMillimes: toMillimes(form.priceDinars),
        vatRate: Number(form.vatRate),
        prepTimeMin: form.prepTimeMin === '' ? null : Number(form.prepTimeMin),
        allergens: form.allergens,
        tags: form.tags,
        isActive: form.isActive,
        isAvailable: form.isAvailable,
        isFeatured: form.isFeatured,
        sortOrder: Number(form.sortOrder) || 0,
        recipe: form.recipe.map((l) => ({ ingredientId: l.ingredientId, quantity: Number(l.quantity) })),
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  const retire = async () => {
    try {
      await remove.mutateAsync(form.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Retrait impossible'));
    }
  };

  const usedIds = new Set(form.recipe.map((l) => l.ingredientId));

  return (
    <Modal open onClose={onClose} title={form.id ? form.name || 'Plat' : 'Nouveau plat'} width="max-w-4xl">
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* ------------------------------ Fiche commerciale */}
        <section className="space-y-4">
          <h3 className="display text-sm text-[var(--color-brand)]">La carte</h3>

          <Field label="Nom du plat">
            <Input required minLength={2} value={form.name} onChange={set('name')} autoFocus />
          </Field>

          <Field label="Description" hint="Ce que lit le client sur le menu QR">
            <textarea
              className="input min-h-[72px] resize-y"
              maxLength={500}
              value={form.description}
              onChange={set('description')}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Catégorie">
              <Select required value={form.categoryId} onChange={set('categoryId')}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Temps de préparation (min)">
              <Input type="number" min="0" max="240" value={form.prepTimeMin} onChange={set('prepTimeMin')} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prix TTC (DT)" hint="Prix affiché au client">
              <Input
                type="number" min="0" step="0.001" required inputMode="decimal"
                value={form.priceDinars} onChange={set('priceDinars')}
              />
            </Field>
            <Field label="TVA">
              <Select value={form.vatRate} onChange={set('vatRate')}>
                {(reference?.data?.vatRates ?? [0, 7, 13, 19]).map((r) => <option key={r} value={r}>{r} %</option>)}
              </Select>
            </Field>
          </div>

          <div>
            <span className="label">Allergènes</span>
            <div className="flex flex-wrap gap-1.5">
              {(reference?.data?.allergens ?? Object.keys(ALLERGEN_LABELS)).map((a) => (
                <Chip key={a} active={form.allergens.includes(a)} onClick={() => toggleIn('allergens', a)}>
                  {ALLERGEN_LABELS[a] ?? a}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Étiquettes</span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((t) => (
                <Chip key={t} active={form.tags.includes(t)} onClick={() => toggleIn('tags', t)}>
                  {TAG_LABELS[t]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> À la carte
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isAvailable} onChange={set('isAvailable')} /> Disponible
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} /> Mis en avant
            </label>
          </div>

          {form.id ? <PhotoField itemId={form.id} imagePath={form.imagePath}
                                 onChange={(imagePath) => setForm((f) => ({ ...f, imagePath }))} />
            : <p className="text-xs text-[var(--color-ink-faint)]">La photo s'ajoute une fois le plat enregistré.</p>}
        </section>

        {/* ------------------------------ Fiche technique */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="display text-sm text-[var(--color-brand)]">Fiche technique</h3>
            <span className="text-xs text-[var(--color-ink-faint)]">Quantités par portion</span>
          </div>

          <div className="space-y-2">
            {form.recipe.length === 0 && (
              <p className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-3 py-3 text-sm text-[var(--color-ink-soft)]">
                Sans fiche technique, le coût matière et la marge de ce plat ne peuvent pas être calculés.
              </p>
            )}
            {form.recipe.map((line, index) => {
              const ing = byId.get(line.ingredientId);
              const lineCost = ing ? Number(line.quantity || 0) * ing.avgCostMillimes : 0;
              return (
                <div key={index} className="grid grid-cols-[1fr_110px_90px_32px] items-center gap-2">
                  <Select
                    aria-label="Ingrédient"
                    value={line.ingredientId}
                    onChange={(e) => setLine(index, { ingredientId: e.target.value })}
                  >
                    <option value="">Ingrédient...</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id} disabled={usedIds.has(i.id) && i.id !== line.ingredientId}>
                        {i.name}
                      </option>
                    ))}
                  </Select>
                  <div className="relative">
                    <Input
                      aria-label="Quantité"
                      type="number" min="0.001" step="0.001" inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: e.target.value })}
                      className="pr-12"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--color-ink-faint)]">
                      {ing?.unit ?? ''}
                    </span>
                  </div>
                  <span className="text-right text-sm tabular text-[var(--color-ink-soft)]">
                    {formatTND(Math.round(lineCost), { withSymbol: false })}
                  </span>
                  <button
                    type="button"
                    aria-label="Retirer la ligne"
                    onClick={() => setForm((f) => ({ ...f, recipe: f.recipe.filter((_, i) => i !== index) }))}
                    className="grid h-8 w-8 place-items-center rounded text-[var(--color-ink-faint)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <Button
              type="button" variant="ghost"
              onClick={() => setForm((f) => ({ ...f, recipe: [...f.recipe, { ingredientId: '', quantity: '' }] }))}
            >
              <Plus size={15} /> Ajouter un ingrédient
            </Button>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-[var(--color-ink-soft)]">Prix HT</span>
              <span className="text-right tabular">{formatTND(preview.priceHt)}</span>
              <span className="text-[var(--color-ink-soft)]">Coût matière</span>
              <span className="text-right tabular">{formatTND(preview.cost)}</span>
              <span className="font-medium">Marge brute HT</span>
              <span className={cx('text-right tabular font-semibold', preview.margin < 0 && 'text-[var(--color-danger)]')}>
                {formatTND(preview.margin)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <span className="text-sm text-[var(--color-ink-soft)]">Ratio matière</span>
              <Badge tone={foodCostTone(preview.pct)}>{formatPct(preview.pct)}</Badge>
            </div>
            <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
              Calculé sur le coût moyen pondéré actuel des ingrédients : il suit les prix d'achat.
            </p>
          </div>
        </section>

        <div className="lg:col-span-2 space-y-3 border-t border-[var(--color-border)] pt-4">
          <ErrorNote message={error} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {form.id && form.isActive
              ? <Button type="button" variant="ghost" onClick={retire} loading={remove.isPending}>Retirer de la carte</Button>
              : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
              <Button type="submit" loading={save.isPending}>Enregistrer</Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
          : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)]',
      )}
    >
      {children}
    </button>
  );
}

function PhotoField({ itemId, imagePath, onChange }) {
  const inputRef = useRef(null);
  const upload = useUploadMenuImage();
  const removeImage = useDeleteMenuImage();
  const [error, setError] = useState('');

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const result = await upload.mutateAsync({ id: itemId, file });
      onChange(result.data.imagePath);
    } catch (err) {
      setError(errorMessage(err, 'Téléversement impossible'));
    }
  };

  return (
    <div>
      <span className="label">Photo</span>
      <div className="flex items-center gap-3">
        <div className="h-20 w-28 overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
          {imagePath
            ? <img src={imagePath} alt="" className="h-full w-full object-cover" />
            : <div className="grid h-full place-items-center text-[var(--color-ink-faint)]"><ImagePlus size={20} /></div>}
        </div>
        <div className="flex flex-col gap-1.5">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
          <Button type="button" variant="secondary" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
            {imagePath ? 'Changer la photo' : 'Ajouter une photo'}
          </Button>
          {imagePath && (
            <Button
              type="button" variant="ghost" loading={removeImage.isPending}
              onClick={async () => { await removeImage.mutateAsync(itemId); onChange(null); }}
            >
              Retirer
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-faint)]">JPEG, PNG ou WebP, 5 Mo maximum. Format paysage conseillé.</p>
      <ErrorNote message={error} />
    </div>
  );
}

