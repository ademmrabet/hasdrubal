import { Link } from 'react-router-dom';
import { AlertTriangle, PackageX, Trash2, Wallet } from 'lucide-react';
import { useDashboard } from '@/api/hooks';
import { formatDate, formatQty, formatTND } from '@/lib/format';
import { BarChart, Button, Card, EmptyState, PageHeader, Reveal, Spinner, StatCard, Table } from '@/components/ui';

export default function Dashboard() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) return <Spinner />;
  if (error) return <EmptyState message="Impossible de charger le tableau de bord." />;

  const d = data.data;
  const alertTotal = d.outOfStock + d.lowStock;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble du stock et de sa valeur"
        actions={
          alertTotal > 0 && (
            <Link to="/admin/alertes">
              <Button variant="secondary"><AlertTriangle size={15} /> Voir les alertes</Button>
            </Link>
          )
        }
      />

      <Reveal className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6" deps={[d.stockValueMillimes]}>
        <StatCard
          label="Valeur du stock"
          value={d.stockValueMillimes}
          format={(v) => formatTND(v)}
          hint={`${d.ingredientCount} ingrédients actifs`}
          icon={Wallet}
        />
        <StatCard
          label="En rupture"
          value={d.outOfStock}
          hint="À commander en priorité"
          tone={d.outOfStock > 0 ? 'danger' : 'ok'}
          icon={PackageX}
        />
        <StatCard
          label="Stock bas"
          value={d.lowStock}
          hint="Sous le seuil d'alerte"
          tone={d.lowStock > 0 ? 'warn' : 'ok'}
          icon={AlertTriangle}
        />
        <StatCard
          label="Pertes du mois"
          value={d.wasteThisMonthMillimes}
          format={(v) => formatTND(v)}
          hint="Produits jetés ou abîmés"
          tone={d.wasteThisMonthMillimes > 0 ? 'warn' : 'ok'}
          icon={Trash2}
        />
      </Reveal>

      <Reveal className="grid gap-4 lg:grid-cols-3" deps={[d.movementTrend?.length]}>
        <Card className="gsap-reveal lg:col-span-2 lg:self-start">
          <h2 className="text-sm font-semibold mb-1">Mouvements sur 14 jours</h2>
          <p className="text-xs text-[var(--color-ink-soft)] mb-4">Valorisés au coût d'achat</p>
          <BarChart
            data={d.movementTrend.map((point) => ({
              label: point.date,
              primary: point.inMillimes,
              secondary: point.outMillimes,
            }))}
            height={210}
            formatValue={(v) => formatTND(v, { compact: true })}
            formatLabel={(label) => formatDate(label)}
          />
        </Card>

        <Card className="gsap-reveal">
          <h2 className="text-sm font-semibold mb-1">Stock le plus valorisé</h2>
          <p className="text-xs text-[var(--color-ink-soft)] mb-3">Là où dort votre trésorerie</p>
          <Table
            columns={[
              { key: 'name', header: 'Ingrédient' },
              {
                key: 'qty', header: 'Quantité', align: 'right',
                render: (row) => formatQty(row.currentQty, row.unit),
              },
              {
                key: 'value', header: 'Valeur', align: 'right',
                render: (row) => formatTND(row.stockValueMillimes),
              },
            ]}
            rows={d.topValueIngredients}
            keyField="name"
            empty="Aucun stock valorisé"
          />
        </Card>
      </Reveal>
    </>
  );
}
