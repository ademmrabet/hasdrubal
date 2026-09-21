import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, ImageOff, Plus, QrCode, Scale, Utensils } from 'lucide-react';
import {
  useDeleteMenuCategory, useMenuCategories, useMenuItems, useSaveMenuCategory, useSetAvailability,
} from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { foodCostTone, FOOD_COST_TARGETS, formatMenuPrice, formatPct, formatTND, TAG_LABELS } from '@/lib/format';
import {
  Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Reveal, Spinner, StatCard, cx,
} from '@/components/ui';
import MenuItemEditor from './MenuItemEditor';

export default function Menu() {
  const { data: catData, isLoading: catLoading } = useMenuCategories();
  const { data: itemData, isLoading: itemLoading } = useMenuItems({ includeInactive: true });
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState(null);         // { itemId?, categoryId? }
  const [categoryForm, setCategoryForm] = useState(null);
  const [showRetired, setShowRetired] = useState(false);

  const categories = catData?.data ?? [];
  const items = itemData?.data ?? [];
  const active = items.filter((i) => i.isActive);

  const stats = useMemo(() => {
    const costed = active.filter((i) => i.recipeLineCount > 0 && i.priceHtMillimes > 0);
    const totalHt = costed.reduce((s, i) => s + i.priceHtMillimes, 0);
    const totalCost = costed.reduce((s, i) => s + i.foodCostMillimes, 0);
    return {
      count: active.length,
      // Ratio global pondere par le prix : un plat cher pese plus qu'une boisson.
      avgPct: totalHt ? (totalCost * 100) / totalHt : 0,
      overTarget: costed.filter((i) => i.foodCostPct > FOOD_COST_TARGETS.warn).length,
      noRecipe: active.filter((i) => i.recipeLineCount === 0).length,
    };
  }, [active]);

  if (catLoading || itemLoading) return <Spinner />;

  const visibleCategories = categories.filter((c) => !filter || c.id === filter);

  return (
    <>
      <PageHeader
        title="La carte"
        subtitle="Plats, prix, fiches techniques et marges"
        actions={
          <>
            <Link to="/admin/carte/qr"><Button variant="secondary"><QrCode size={15} /> Menu QR</Button></Link>
            <Button variant="secondary" onClick={() => setCategoryForm({ name: '', description: '', sortOrder: categories.length + 1, isActive: true })}>
              <Plus size={15} /> Catégorie
            </Button>
            <Button onClick={() => setEditor({ categoryId: filter || categories[0]?.id })} disabled={!categories.length}>
              <Plus size={15} /> Nouveau plat
            </Button>
          </>
        }
      />

      <Reveal className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-5" deps={[items.length]}>
        <StatCard label="Plats à la carte" value={stats.count} icon={Utensils} hint={`${categories.length} catégories`} />
        <StatCard
          label="Ratio matière moyen"
          value={stats.avgPct}
          format={(v) => formatPct(v)}
          tone={foodCostTone(stats.avgPct)}
          icon={Scale}
          hint={`Objectif : sous ${FOOD_COST_TARGETS.ok} %`}
        />
        <StatCard
          label="Au-dessus du seuil"
          value={stats.overTarget}
          tone={stats.overTarget ? 'danger' : 'ok'}
          icon={AlertTriangle}
          hint={`Ratio supérieur à ${FOOD_COST_TARGETS.warn} %`}
        />
        <StatCard
          label="Sans fiche technique"
          value={stats.noRecipe}
          tone={stats.noRecipe ? 'warn' : 'ok'}
          icon={BookOpen}
          hint="Coût et marge inconnus"
        />
      </Reveal>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip active={!filter} onClick={() => setFilter('')}>Tout</FilterChip>
        {categories.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.name} <span className="opacity-60">{c.itemCount}</span>
          </FilterChip>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Afficher les plats retirés
        </label>
      </div>

      {categories.length === 0 && (
        <Card><EmptyState message="Commencez par créer une catégorie (Entrées, Plats...)." /></Card>
      )}

      <div className="space-y-4">
        {visibleCategories.map((category) => {
          const rows = items.filter((i) => i.categoryId === category.id && (showRetired || i.isActive));
          return (
            <Card key={category.id} className="p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                <div>
                  <h2 className="text-base text-[var(--color-brand)]">{category.name}</h2>
                  {category.description && <p className="text-xs text-[var(--color-ink-faint)]">{category.description}</p>}
                </div>
                <div className="flex gap-1">
                  {!category.isActive && <Badge>Masquée</Badge>}
                  <Button variant="ghost" onClick={() => setCategoryForm({ ...category })}>Modifier</Button>
                  <Button variant="ghost" onClick={() => setEditor({ categoryId: category.id })}><Plus size={14} /> Plat</Button>
                </div>
              </div>
              {rows.length === 0
                ? <EmptyState message="Aucun plat dans cette catégorie." />
                : <DishTable rows={rows} onOpen={(item) => setEditor({ itemId: item.id })} />}
            </Card>
          );
        })}
      </div>

      {editor && (
        <MenuItemEditor
          itemId={editor.itemId}
          defaultCategoryId={editor.categoryId}
          categories={categories}
          onClose={() => setEditor(null)}
        />
      )}
      {categoryForm && <CategoryForm initial={categoryForm} onClose={() => setCategoryForm(null)} />}
    </>
  );
}

function DishTable({ rows, onOpen }) {
  const setAvailability = useSetAvailability();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
            <th className="py-2.5 px-3 text-left font-semibold">Plat</th>
            <th className="py-2.5 px-3 text-right font-semibold">Prix TTC</th>
            <th className="py-2.5 px-3 text-right font-semibold">Coût matière</th>
            <th className="py-2.5 px-3 text-right font-semibold">Marge HT</th>
            <th className="py-2.5 px-3 text-right font-semibold">Ratio</th>
            <th className="py-2.5 px-3 text-right font-semibold" title="Portions réalisables avec le stock actuel">Portions</th>
            <th className="py-2.5 px-3 text-right font-semibold">En service</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr
              key={item.id}
              onClick={() => onOpen(item)}
              className={cx(
                'cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-muted)]',
                !item.isActive && 'opacity-50',
              )}
            >
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-14 shrink-0 overflow-hidden rounded bg-[var(--color-surface-muted)]">
                    {item.imagePath
                      ? <img src={item.imagePath} alt="" className="h-full w-full object-cover" loading="lazy" />
                      : <div className="grid h-full place-items-center text-[var(--color-ink-faint)]"><ImageOff size={14} /></div>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {item.tags.map((t) => <Badge key={t} tone={t === 'signature' ? 'brand' : 'neutral'}>{TAG_LABELS[t] ?? t}</Badge>)}
                      {!item.isActive && <Badge>Retiré</Badge>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-2.5 px-3 text-right tabular">{formatMenuPrice(item.priceMillimes)}</td>
              <td className="py-2.5 px-3 text-right tabular">
                {item.recipeLineCount ? formatTND(item.foodCostMillimes) : <span className="text-[var(--color-ink-faint)]">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right tabular">
                {item.recipeLineCount ? formatTND(item.marginMillimes) : <span className="text-[var(--color-ink-faint)]">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right">
                {item.recipeLineCount
                  ? <Badge tone={foodCostTone(item.foodCostPct)}>{formatPct(item.foodCostPct)}</Badge>
                  : <Badge tone="warn">Sans fiche</Badge>}
              </td>
              <td className="py-2.5 px-3 text-right tabular">
                {item.portionsPossible == null ? '—' : (
                  <span className={cx(item.portionsPossible < 5 && 'font-semibold text-[var(--color-danger)]')}>
                    {item.portionsPossible}
                  </span>
                )}
              </td>
              <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                <Toggle
                  checked={item.isAvailable}
                  disabled={!item.isActive}
                  label={`${item.name} disponible`}
                  onChange={(value) => setAvailability.mutate({ id: item.id, isAvailable: value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label, size = 'md' }) {
  const big = size === 'lg';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-40',
        big ? 'h-8 w-14' : 'h-6 w-10',
        checked ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-border)]',
      )}
    >
      <span
        className={cx(
          'inline-block rounded-full bg-white shadow transition-transform',
          big ? 'h-6 w-6' : 'h-4 w-4',
          checked ? (big ? 'translate-x-7' : 'translate-x-5') : 'translate-x-1',
        )}
      />
    </button>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)]',
      )}
    >
      {children}
    </button>
  );
}

function CategoryForm({ initial, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const save = useSaveMenuCategory();
  const remove = useDeleteMenuCategory();
  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await save.mutateAsync({
        id: form.id, name: form.name, description: form.description || null,
        sortOrder: Number(form.sortOrder) || 0, isActive: form.isActive,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  const destroy = async () => {
    setError('');
    try {
      await remove.mutateAsync(form.id);
      onClose();
    } catch (err) {
      setError(err?.response?.status === 409
        ? 'Cette catégorie contient encore des plats : déplacez-les ou masquez la catégorie.'
        : errorMessage(err, 'Suppression impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title={form.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom"><Input required minLength={2} value={form.name} onChange={set('name')} autoFocus /></Field>
        <Field label="Sous-titre" hint="Affiché sous le nom sur le menu QR">
          <Input value={form.description ?? ''} onChange={set('description')} />
        </Field>
        <Field label="Ordre d'affichage">
          <Input type="number" value={form.sortOrder} onChange={set('sortOrder')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Visible sur le menu
        </label>
        <ErrorNote message={error} />
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          {form.id ? <Button type="button" variant="ghost" onClick={destroy} loading={remove.isPending}>Supprimer</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={save.isPending}>Enregistrer</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
