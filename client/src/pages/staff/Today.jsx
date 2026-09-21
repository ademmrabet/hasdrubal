import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, PackagePlus } from 'lucide-react';
import { useStaffToday } from '@/api/hooks';
import { formatDate, formatQty, MOVEMENT_LABELS } from '@/lib/format';
import { Badge, Button, Card, EmptyState, PageHeader, Reveal, Spinner } from '@/components/ui';

export default function StaffToday() {
  const { data, isLoading } = useStaffToday();

  if (isLoading) return <Spinner />;

  const { alerts = [], expiring = [], recentMovements = [] } = data?.data ?? {};

  return (
    <>
      <PageHeader
        title="Ma journée"
        subtitle="Ce qu'il faut surveiller pendant le service"
        actions={<Link to="/service/stock"><Button><PackagePlus size={16} /> Saisir un mouvement</Button></Link>}
      />

      <Reveal className="space-y-4" deps={[alerts.length, expiring.length]}>
        <Card className="gsap-reveal">
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <AlertTriangle size={16} className="text-[var(--color-warn)]" />
            Stock à surveiller
          </h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">Tout est au niveau. Bon service.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {alerts.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      Seuil : {formatQty(item.minThreshold, item.unit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular">{formatQty(item.currentQty, item.unit)}</p>
                    <Badge tone={item.stockStatus === 'rupture' ? 'danger' : 'warn'}>
                      {item.stockStatus === 'rupture' ? 'Rupture' : 'Bas'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="gsap-reveal">
          <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Clock size={16} className="text-[var(--color-ink-soft)]" />
            À consommer en priorité
          </h2>
          {expiring.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">Aucun produit proche de la péremption.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {expiring.map((item, index) => (
                <li key={`${item.ingredientName}-${index}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium text-sm">{item.ingredientName}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      {formatQty(item.quantityRemaining, item.unit)} · {formatDate(item.expiresAt)}
                    </p>
                  </div>
                  <Badge tone={item.expiryStatus === 'perime' ? 'danger' : 'warn'}>
                    {item.expiryStatus === 'perime' ? 'Périmé' : `${item.daysLeft} j`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="gsap-reveal">
          <h2 className="text-sm font-semibold mb-3">Mouvements du jour</h2>
          {recentMovements.length === 0 ? (
            <EmptyState message="Aucun mouvement enregistré aujourd'hui." />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {recentMovements.map((m, index) => (
                <li key={index} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{MOVEMENT_LABELS[m.type]}</span> · {m.ingredientName}
                  </span>
                  <span className="text-[var(--color-ink-soft)] tabular">{formatQty(m.quantity, m.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
    </>
  );
}
