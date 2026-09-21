import { useState } from 'react';
import { useIngredients, useMovements } from '@/api/hooks';
import { formatDateTime, formatQty, formatTND, MOVEMENT_LABELS } from '@/lib/format';
import { Badge, Button, Card, Input, PageHeader, Select, Spinner, Table } from '@/components/ui';

const TYPE_TONE = { entree: 'ok', sortie: 'neutral', perte: 'danger', ajustement: 'warn' };
const PAGE_SIZE = 50;

export default function Movements() {
  const [filters, setFilters] = useState({ ingredientId: '', type: '', from: '', to: '' });
  const [offset, setOffset] = useState(0);

  const { data: ingredients } = useIngredients({ includeInactive: true });
  const query = useMovements({
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    limit: PAGE_SIZE,
    offset,
  });

  const set = (key) => (e) => {
    setOffset(0);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  const total = query.data?.total ?? 0;

  return (
    <>
      <PageHeader title="Mouvements de stock" subtitle="Journal complet : chaque opération est tracée et nominative" />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Select value={filters.ingredientId} onChange={set('ingredientId')}>
            <option value="">Tous les ingrédients</option>
            {ingredients?.data?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
          <Select value={filters.type} onChange={set('type')}>
            <option value="">Tous les types</option>
            {Object.entries(MOVEMENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
          <Input type="date" value={filters.from} onChange={set('from')} aria-label="Date de début" />
          <Input type="date" value={filters.to} onChange={set('to')} aria-label="Date de fin" />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {query.isLoading ? <Spinner /> : (
          <Table
            rows={query.data?.data ?? []}
            empty="Aucun mouvement sur cette période."
            columns={[
              { key: 'createdAt', header: 'Date', render: (m) => formatDateTime(m.createdAt) },
              {
                key: 'type', header: 'Type',
                render: (m) => <Badge tone={TYPE_TONE[m.type]}>{MOVEMENT_LABELS[m.type]}</Badge>,
              },
              { key: 'ingredientName', header: 'Ingrédient' },
              {
                key: 'quantity', header: 'Quantité', align: 'right',
                render: (m) => formatQty(m.quantity, m.unit),
              },
              {
                key: 'valueMillimes', header: 'Valeur', align: 'right',
                render: (m) => formatTND(m.valueMillimes),
              },
              { key: 'reason', header: 'Motif', render: (m) => m.reason ?? '—' },
              { key: 'createdByName', header: 'Par', render: (m) => m.createdByName ?? 'Système' },
            ]}
          />
        )}
      </Card>

      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
          <span>{offset + 1} – {Math.min(offset + PAGE_SIZE, total)} sur {total}</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>Précédent</Button>
            <Button variant="secondary" disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}>Suivant</Button>
          </div>
        </div>
      )}
    </>
  );
}
