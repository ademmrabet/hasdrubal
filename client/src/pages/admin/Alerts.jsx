import { useAlerts } from '@/api/hooks';
import { formatDate, formatQty, formatTND } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader, Reveal, Spinner, Table } from '@/components/ui';

export default function Alerts() {
  const { data, isLoading } = useAlerts();

  if (isLoading) return <Spinner />;

  const { lowStock = [], expiring = [] } = data?.data ?? {};
  const reorderTotal = lowStock.reduce(
    (sum, row) => sum + (row.suggestedReorderQty ?? 0) * (row.avgCostMillimes ?? 0), 0,
  );

  return (
    <>
      <PageHeader
        title="Alertes"
        subtitle="Ce qui doit être commandé et ce qui va périmer"
      />

      <Reveal className="space-y-4" deps={[lowStock.length, expiring.length]}>
        <Card className="gsap-reveal p-0 overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-sm font-semibold">À commander ({lowStock.length})</h2>
            {reorderTotal > 0 && (
              <span className="text-xs text-[var(--color-ink-soft)]">
                Réassort estimé : {formatTND(Math.round(reorderTotal))}
              </span>
            )}
          </div>
          {lowStock.length === 0 ? (
            <EmptyState message="Tous les ingrédients sont au-dessus de leur seuil." />
          ) : (
            <Table
              rows={lowStock}
              columns={[
                { key: 'name', header: 'Ingrédient' },
                {
                  key: 'currentQty', header: 'En stock', align: 'right',
                  render: (row) => formatQty(row.currentQty, row.unit),
                },
                {
                  key: 'minThreshold', header: 'Seuil', align: 'right',
                  render: (row) => formatQty(row.minThreshold, row.unit),
                },
                {
                  key: 'suggestedReorderQty', header: 'À commander', align: 'right',
                  render: (row) => (
                    <span className="font-medium">{formatQty(row.suggestedReorderQty, row.unit)}</span>
                  ),
                },
                {
                  key: 'cost', header: 'Coût estimé', align: 'right',
                  render: (row) => formatTND(Math.round(row.suggestedReorderQty * row.avgCostMillimes)),
                },
                { key: 'supplierName', header: 'Fournisseur', render: (row) => row.supplierName ?? '—' },
                {
                  key: 'stockStatus', header: 'État', align: 'right',
                  render: (row) => (
                    <Badge tone={row.stockStatus === 'rupture' ? 'danger' : 'warn'}>
                      {row.stockStatus === 'rupture' ? 'Rupture' : 'Stock bas'}
                    </Badge>
                  ),
                },
              ]}
            />
          )}
        </Card>

        <Card className="gsap-reveal p-0 overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Péremptions sous 7 jours ({expiring.length})</h2>
          </div>
          {expiring.length === 0 ? (
            <EmptyState message="Aucun lot proche de la péremption." />
          ) : (
            <Table
              rows={expiring}
              columns={[
                { key: 'ingredientName', header: 'Ingrédient' },
                { key: 'batchCode', header: 'Lot', render: (row) => row.batchCode ?? '—' },
                {
                  key: 'quantityRemaining', header: 'Restant', align: 'right',
                  render: (row) => formatQty(row.quantityRemaining, row.unit),
                },
                {
                  key: 'valueMillimes', header: 'Valeur', align: 'right',
                  render: (row) => formatTND(row.valueMillimes),
                },
                { key: 'expiresAt', header: 'Péremption', render: (row) => formatDate(row.expiresAt) },
                {
                  key: 'daysLeft', header: 'Délai', align: 'right',
                  render: (row) => (
                    <Badge tone={row.expiryStatus === 'perime' ? 'danger' : 'warn'}>
                      {row.expiryStatus === 'perime'
                        ? `Périmé depuis ${Math.abs(row.daysLeft)} j`
                        : `${row.daysLeft} j restants`}
                    </Badge>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </Reveal>
    </>
  );
}
