import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useSaveSupplier, useSuppliers } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Spinner, Table } from '@/components/ui';

const EMPTY = {
  name: '', contactName: '', phone: '', email: '', address: '',
  taxId: '', paymentTermsDays: 0, notes: '', isActive: true,
};

export default function Suppliers() {
  const { data, isLoading } = useSuppliers({ includeInactive: true });
  const [editing, setEditing] = useState(null);

  return (
    <>
      <PageHeader
        title="Fournisseurs"
        subtitle="Contacts, délais de paiement et matricule fiscal"
        actions={<Button onClick={() => setEditing({ ...EMPTY })}><Plus size={15} /> Nouveau fournisseur</Button>}
      />

      <Card className="p-0 overflow-hidden">
        {isLoading ? <Spinner /> : (
          <Table
            rows={data?.data ?? []}
            onRowClick={(row) => setEditing({ ...EMPTY, ...row })}
            empty="Aucun fournisseur enregistré."
            columns={[
              {
                key: 'name', header: 'Fournisseur',
                render: (row) => (
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{row.contactName ?? '—'}</p>
                  </div>
                ),
              },
              { key: 'phone', header: 'Téléphone', render: (row) => row.phone ?? '—' },
              { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
              { key: 'taxId', header: 'Matricule fiscal', render: (row) => row.taxId ?? '—' },
              {
                key: 'paymentTermsDays', header: 'Paiement', align: 'right',
                render: (row) => (row.paymentTermsDays ? `${row.paymentTermsDays} jours` : 'Comptant'),
              },
              {
                key: 'isActive', header: 'État', align: 'right',
                render: (row) => <Badge tone={row.isActive ? 'ok' : 'neutral'}>{row.isActive ? 'Actif' : 'Inactif'}</Badge>,
              },
            ]}
          />
        )}
      </Card>

      {editing && <SupplierForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SupplierForm({ initial, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const save = useSaveSupplier();
  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await save.mutateAsync({ ...form, paymentTermsDays: Number(form.paymentTermsDays) || 0 });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title={form.id ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Raison sociale">
          <Input required minLength={2} value={form.name} onChange={set('name')} autoFocus />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Personne de contact">
            <Input value={form.contactName ?? ''} onChange={set('contactName')} />
          </Field>
          <Field label="Téléphone">
            <Input value={form.phone ?? ''} onChange={set('phone')} placeholder="+216 ..." />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={form.email ?? ''} onChange={set('email')} />
          </Field>
          <Field label="Matricule fiscal">
            <Input value={form.taxId ?? ''} onChange={set('taxId')} />
          </Field>
        </div>

        <Field label="Adresse">
          <Input value={form.address ?? ''} onChange={set('address')} />
        </Field>

        <Field label="Délai de paiement (jours)" hint="0 pour un paiement comptant">
          <Input type="number" min="0" max="365" value={form.paymentTermsDays} onChange={set('paymentTermsDays')} />
        </Field>

        <Field label="Notes">
          <Input value={form.notes ?? ''} onChange={set('notes')} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
          Fournisseur actif
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
