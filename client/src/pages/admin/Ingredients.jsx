import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  useCategories, useDeleteIngredients, useIngredient, useIngredients, useInventoryCount, useSaveIngredient,
  useSuppliers, useUpdateIngredientCost,
} from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { formatDate, formatQty, formatTND, STATUS_LABELS, toDinars, toMillimes, UNIT_LABELS } from '@/lib/format';
import {
  Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table,
} from '@/components/ui';

const STATUS_TONE = { ok: 'ok', bas: 'warn', rupture: 'danger' };

const EMPTY = {
  name: '', categoryId: '', unit: 'kg', minThreshold: 0, targetStock: 0,
  isPerishable: false, shelfLifeDays: '', defaultSupplierId: '', isActive: true,
};

export default function Ingredients() {
  const [filters, setFilters] = useState({ search: '', categoryId: '', status: '' });
  const [editing, setEditing] = useState(null);   // objet formulaire ou null
  const [detailId, setDetailId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const query = useIngredients(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const rows = query.data?.data ?? [];
  const deleteIngredients = useDeleteIngredients();
  const [deleteError, setDeleteError] = useState('');

  // Une ligne retirée de la liste (filtre changé, suppression) ne doit pas rester cochée.
  useEffect(() => {
    const visibleIds = new Set(rows.map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const selection = useMemo(() => ({
    selectedIds,
    onToggle: (id) => setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    }),
    onToggleAll: () => setSelectedIds((prev) => {
      const allSelected = rows.length > 0 && rows.every((r) => prev.has(r.id));
      return allSelected ? new Set() : new Set(rows.map((r) => r.id));
    }),
  }), [selectedIds, rows]);

  const confirmDelete = async () => {
    setDeleteError('');
    try {
      await deleteIngredients.mutateAsync([...selectedIds]);
      setSelectedIds(new Set());
      setConfirmingDelete(false);
    } catch (err) {
      setDeleteError(errorMessage(err, 'Suppression impossible'));
    }
  };

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="Niveaux de stock, seuils d'alerte et coût moyen"
        actions={<Button onClick={() => setEditing({ ...EMPTY })}><Plus size={15} /> Nouvel ingrédient</Button>}
      />

      {selectedIds.size > 0 && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm font-medium">
            {selectedIds.size} ingrédient{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>Annuler</Button>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={15} /> Supprimer
            </Button>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="relative block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
            <Input
              className="pl-9"
              placeholder="Rechercher un ingrédient"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </label>
          <Select value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="">Toutes les catégories</option>
            {categories?.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Tous les niveaux</option>
            <option value="rupture">En rupture</option>
            <option value="bas">Stock bas</option>
            <option value="ok">Normal</option>
          </Select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {query.isLoading ? <Spinner /> : (
          <Table
            rows={rows}
            onRowClick={(row) => setDetailId(row.id)}
            empty="Aucun ingrédient ne correspond à ces filtres."
            selection={selection}
            columns={[
              {
                key: 'name', header: 'Ingrédient',
                render: (row) => (
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{row.categoryName ?? 'Sans catégorie'}</p>
                  </div>
                ),
              },
              {
                key: 'currentQty', header: 'En stock', align: 'right',
                render: (row) => formatQty(row.currentQty, row.unit),
              },
              {
                key: 'minThreshold', header: 'Seuil', align: 'right',
                render: (row) => formatQty(row.minThreshold, row.unit),
              },
              {
                key: 'avgCostMillimes', header: 'Coût moyen', align: 'right',
                render: (row) => `${formatTND(row.avgCostMillimes)} / ${row.unit}`,
              },
              {
                key: 'stockValueMillimes', header: 'Valeur', align: 'right',
                render: (row) => formatTND(row.stockValueMillimes),
              },
              {
                key: 'stockStatus', header: 'État', align: 'right',
                render: (row) => <Badge tone={STATUS_TONE[row.stockStatus]}>{STATUS_LABELS[row.stockStatus]}</Badge>,
              },
            ]}
          />
        )}
      </Card>

      {editing && (
        <IngredientForm
          initial={editing}
          categories={categories?.data ?? []}
          suppliers={suppliers?.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      {detailId && (
        <IngredientDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(row) => {
            setDetailId(null);
            setEditing({
              id: row.id, name: row.name, categoryId: row.categoryId ?? '', unit: row.unit,
              minThreshold: row.minThreshold, targetStock: row.targetStock,
              isPerishable: row.isPerishable, shelfLifeDays: row.shelfLifeDays ?? '',
              defaultSupplierId: row.defaultSupplierId ?? '', isActive: row.isActive,
            });
          }}
        />
      )}

      {confirmingDelete && (
        <Modal open onClose={() => setConfirmingDelete(false)} title="Supprimer ces ingrédients ?">
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-ink-soft)]">
              {selectedIds.size} ingrédient{selectedIds.size > 1 ? 's vont' : ' va'} être retiré{selectedIds.size > 1 ? 's' : ''} des
              listes actives et de la carte. L'historique des mouvements de stock et des fiches techniques passées
              est conservé.
            </p>
            <ErrorNote message={deleteError} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Annuler</Button>
              <Button variant="danger" loading={deleteIngredients.isPending} onClick={confirmDelete}>
                Supprimer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
function IngredientForm({ initial, categories, suppliers, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const save = useSaveIngredient();
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await save.mutateAsync({
        ...form,
        categoryId: form.categoryId || null,
        defaultSupplierId: form.defaultSupplierId || null,
        shelfLifeDays: form.isPerishable ? Number(form.shelfLifeDays) : null,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Enregistrement impossible"));
    }
  };

  return (
    <Modal open onClose={onClose} title={form.id ? 'Modifier l’ingrédient' : 'Nouvel ingrédient'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom">
          <Input required minLength={2} value={form.name} onChange={set('name')} autoFocus />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Catégorie">
            <Select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Unité de mesure">
            <Select value={form.unit} onChange={set('unit')}>
              {Object.entries(UNIT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seuil d'alerte" hint="En dessous, l'ingrédient remonte dans les alertes">
            <Input type="number" min="0" step="0.001" value={form.minThreshold} onChange={set('minThreshold')} />
          </Field>
          <Field label="Stock cible" hint="Niveau à reconstituer à la commande">
            <Input type="number" min="0" step="0.001" value={form.targetStock} onChange={set('targetStock')} />
          </Field>
        </div>

        <Field label="Fournisseur habituel">
          <Select value={form.defaultSupplierId} onChange={set('defaultSupplierId')}>
            <option value="">Aucun</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isPerishable} onChange={set('isPerishable')} />
          Produit périssable
        </label>

        {form.isPerishable && (
          <Field label="Durée de conservation (jours)" hint="Sert à calculer la date de péremption à la réception">
            <Input type="number" min="1" required value={form.shelfLifeDays} onChange={set('shelfLifeDays')} />
          </Field>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
          Actif
        </label>

        <ErrorNote message={error} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={save.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
function IngredientDetail({ id, onClose, onEdit }) {
  const { data, isLoading } = useIngredient(id);
  const inventory = useInventoryCount();
  const updateCost = useUpdateIngredientCost();
  const [counted, setCounted] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newCost, setNewCost] = useState('');
  const [costReason, setCostReason] = useState('');
  const [costMessage, setCostMessage] = useState('');
  const [costError, setCostError] = useState('');

  const row = data?.data;

  const submitInventory = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const result = await inventory.mutateAsync({ ingredientId: id, countedQty: Number(counted) });
      setMessage(
        result.data.delta === 0
          ? 'Aucun écart constaté.'
          : `Écart de ${formatQty(result.data.delta, row.unit)} enregistré.`,
      );
      setCounted('');
    } catch (err) {
      setError(errorMessage(err, 'Inventaire impossible'));
    }
  };

  const submitCost = async (event) => {
    event.preventDefault();
    setCostError('');
    setCostMessage('');
    try {
      await updateCost.mutateAsync({ id, avgCostMillimes: toMillimes(newCost), reason: costReason || null });
      setCostMessage('Coût moyen mis à jour.');
      setNewCost('');
      setCostReason('');
    } catch (err) {
      setCostError(errorMessage(err, 'Mise à jour impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title={row?.name ?? 'Ingrédient'} width="max-w-2xl">
      {isLoading || !row ? <Spinner /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="En stock" value={formatQty(row.currentQty, row.unit)} />
            <Stat label="Seuil" value={formatQty(row.minThreshold, row.unit)} />
            <Stat label="Coût moyen" value={formatTND(row.avgCostMillimes)} />
            <Stat label="Valeur" value={formatTND(row.stockValueMillimes)} />
          </div>

          <section>
            <h3 className="text-sm font-semibold mb-2">Lots en stock</h3>
            <Table
              rows={row.batches}
              empty="Aucun lot ouvert."
              columns={[
                { key: 'batchCode', header: 'Lot', render: (b) => b.batchCode ?? '—' },
                { key: 'supplierName', header: 'Fournisseur', render: (b) => b.supplierName ?? '—' },
                { key: 'quantityRemaining', header: 'Restant', align: 'right',
                  render: (b) => formatQty(b.quantityRemaining, row.unit) },
                { key: 'unitCostMillimes', header: 'Coût unitaire', align: 'right',
                  render: (b) => formatTND(b.unitCostMillimes) },
                { key: 'expiresAt', header: 'Péremption', align: 'right',
                  render: (b) => formatDate(b.expiresAt) },
              ]}
            />
          </section>

          <section className="border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold">Inventaire physique</h3>
            <p className="text-xs text-[var(--color-ink-soft)] mb-3">
              Saisissez la quantité réellement comptée : l'écart est enregistré comme ajustement tracé.
            </p>
            <form onSubmit={submitInventory} className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px]">
                <Field label={`Quantité comptée (${row.unit})`}>
                  <Input type="number" min="0" step="0.001" required value={counted}
                         onChange={(e) => setCounted(e.target.value)} />
                </Field>
              </div>
              <Button type="submit" variant="secondary" loading={inventory.isPending}>Valider l'écart</Button>
            </form>
            {message && <p className="mt-2 text-sm text-[var(--color-ok)]">{message}</p>}
            <div className="mt-2"><ErrorNote message={error} /></div>
          </section>

          <section className="border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold">Coût moyen</h3>
            <p className="text-xs text-[var(--color-ink-soft)] mb-3">
              À utiliser si le prix fournisseur a changé et que la marge affichée sur la carte doit
              le refléter tout de suite. N'affecte ni le stock déjà réceptionné, ni son historique —
              seul le coût de référence pour les nouvelles fiches techniques change.
            </p>
            <form onSubmit={submitCost} className="flex flex-wrap items-end gap-2">
              <div className="w-32">
                <Field label={`Nouveau coût (DT/${row.unit})`}>
                  <Input type="number" min="0" step="0.001" required value={newCost}
                         onChange={(e) => setNewCost(e.target.value)} />
                </Field>
              </div>
              <div className="flex-1 min-w-[160px]">
                <Field label="Motif (optionnel)">
                  <Input value={costReason} onChange={(e) => setCostReason(e.target.value)}
                         placeholder="Ex. nouveau tarif fournisseur" />
                </Field>
              </div>
              <Button type="submit" variant="secondary" loading={updateCost.isPending}>Mettre à jour</Button>
            </form>
            {costMessage && <p className="mt-2 text-sm text-[var(--color-ok)]">{costMessage}</p>}
            <div className="mt-2"><ErrorNote message={costError} /></div>
          </section>

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button onClick={() => onEdit(row)}>Modifier la fiche</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3">
    <p className="text-xs text-[var(--color-ink-faint)]">{label}</p>
    <p className="font-semibold tabular mt-0.5">{value}</p>
  </div>
);
