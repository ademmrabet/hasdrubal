import { useMemo, useState } from 'react';
import { useConsumeStock, useIngredients, useReceiveStock, useSuppliers } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { formatQty, toMillimes } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, cx } from '@/components/ui';

const TABS = [
  { id: 'entree', label: 'Réception' },
  { id: 'sortie', label: 'Sortie' },
  { id: 'perte', label: 'Perte' },
];

/** Saisie rapide des mouvements de stock, pensee pour une tablette. */
export default function StockOps() {
  const [tab, setTab] = useState('entree');
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCostDinars, setUnitCostDinars] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const { data: ingredients } = useIngredients();
  const { data: suppliers } = useSuppliers();
  const receive = useReceiveStock();
  const consume = useConsumeStock();

  const selected = useMemo(
    () => ingredients?.data?.find((i) => i.id === ingredientId),
    [ingredients, ingredientId],
  );

  const reset = () => {
    setQuantity(''); setUnitCostDinars(''); setBatchCode(''); setExpiresAt(''); setReason('');
  };

  const switchTab = (id) => {
    setTab(id);
    setFeedback('');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setFeedback('');
    try {
      if (tab === 'entree') {
        const result = await receive.mutateAsync({
          ingredientId,
          supplierId: supplierId || null,
          quantity: Number(quantity),
          unitCostMillimes: toMillimes(unitCostDinars),
          batchCode: batchCode || null,
          expiresAt: expiresAt || null,
        });
        setFeedback(`Réception enregistrée. Stock : ${formatQty(result.data.quantityAfter, selected?.unit)}.`);
      } else {
        const result = await consume.mutateAsync({
          ingredientId,
          quantity: Number(quantity),
          type: tab,
          reason: reason || null,
        });
        setFeedback(`Mouvement enregistré. Stock restant : ${formatQty(result.data.quantityAfter, selected?.unit)}.`);
      }
      reset();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  const busy = receive.isPending || consume.isPending;

  return (
    <>
      <PageHeader title="Mouvement de stock" subtitle="Réception de marchandise, sortie pour le service ou perte" />

      <div className="mb-4 grid grid-cols-3 gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => switchTab(item.id)}
            className={cx(
              'rounded-[var(--radius-control)] border px-3 py-3 text-sm font-medium transition-colors',
              tab === item.id
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Ingrédient">
            <Select required value={ingredientId} onChange={(e) => setIngredientId(e.target.value)}>
              <option value="">Choisir un ingrédient</option>
              {ingredients?.data?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {formatQty(i.currentQty, i.unit)} en stock
                </option>
              ))}
            </Select>
          </Field>

          <Field label={`Quantité${selected ? ` (${selected.unit})` : ''}`}>
            <Input
              type="number" min="0.001" step="0.001" required inputMode="decimal"
              value={quantity} onChange={(e) => setQuantity(e.target.value)}
              className="text-lg py-3"
            />
          </Field>

          {tab === 'entree' ? (
            <>
              <Field label="Prix unitaire (DT)" hint="Sert à recalculer le coût moyen de l'ingrédient">
                <Input
                  type="number" min="0" step="0.001" inputMode="decimal"
                  value={unitCostDinars} onChange={(e) => setUnitCostDinars(e.target.value)}
                />
              </Field>

              <Field label="Fournisseur">
                <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Non précisé</option>
                  {suppliers?.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Numéro de lot">
                  <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} />
                </Field>
                <Field
                  label="Date de péremption"
                  hint={selected?.isPerishable ? 'Calculée automatiquement si laissée vide' : undefined}
                >
                  <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </Field>
              </div>
            </>
          ) : (
            <Field label="Motif" hint={tab === 'perte' ? 'Produit abîmé, périmé, cassé...' : 'Optionnel'}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}

          {feedback && (
            <p className="rounded-[var(--radius-control)] bg-[var(--color-ok-soft)] px-3 py-2 text-sm text-[var(--color-ok)]">
              {feedback}
            </p>
          )}
          <ErrorNote message={error} />

          <Button type="submit" loading={busy} className="w-full py-3">
            Enregistrer {TABS.find((t) => t.id === tab).label.toLowerCase()}
          </Button>
        </form>
      </Card>
    </>
  );
}
