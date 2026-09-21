import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useMenuItems, useSetAvailability } from '@/api/hooks';
import { Badge, Card, Input, PageHeader, Reveal, Spinner, cx } from '@/components/ui';
import { Toggle } from '@/pages/admin/menu/Menu';

/**
 * Pendant le service : couper un plat en rupture, le remettre quand il revient.
 * Le menu QR des clients affiche "Epuise" immediatement.
 */
export default function StaffCarte() {
  const { data, isLoading } = useMenuItems();
  const setAvailability = useSetAvailability();
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const items = (data?.data ?? []).filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.categoryId)) map.set(item.categoryId, { name: item.categoryName, items: [] });
      map.get(item.categoryId).items.push(item);
    }
    return [...map.values()];
  }, [data, search]);

  if (isLoading) return <Spinner />;

  const offCount = (data?.data ?? []).filter((i) => !i.isAvailable).length;

  return (
    <>
      <PageHeader
        title="La carte du jour"
        subtitle={offCount ? `${offCount} plat(s) coupé(s) en ce moment` : 'Tous les plats sont servis'}
      />

      <label className="relative mb-4 block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
        <Input className="pl-9 py-3" placeholder="Chercher un plat" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>

      <Reveal className="space-y-4" deps={[groups.length]}>
        {groups.map((group) => (
          <Card key={group.name} className="gsap-reveal p-0 overflow-hidden">
            <h2 className="border-b border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-brand)]">{group.name}</h2>
            <ul className="divide-y divide-[var(--color-border)]">
              {group.items.map((item) => (
                <li key={item.id} className={cx('flex items-center justify-between gap-3 px-4 py-3', !item.isAvailable && 'bg-[var(--color-danger-soft)]')}>
                  <div className="min-w-0">
                    <p className={cx('font-medium', !item.isAvailable && 'line-through opacity-70')}>{item.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-faint)]">
                      {item.portionsPossible != null && (
                        <span className={cx(item.portionsPossible < 5 && 'font-semibold text-[var(--color-danger)]')}>
                          Stock pour {item.portionsPossible} portion(s)
                        </span>
                      )}
                      {!item.isAvailable && <Badge tone="danger">Coupé</Badge>}
                    </div>
                  </div>
                  <Toggle
                    size="lg"
                    checked={item.isAvailable}
                    label={`${item.name} disponible`}
                    onChange={(value) => setAvailability.mutate({ id: item.id, isAvailable: value })}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </Reveal>
    </>
  );
}
