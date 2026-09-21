import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useSaveUser, useUsers } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { formatRelative, ROLE_LABELS } from '@/lib/format';
import {
  Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table,
} from '@/components/ui';

const ROLE_TONE = { owner: 'brand', manager: 'ok', staff: 'neutral' };

export default function Users() {
  const { data, isLoading } = useUsers();
  const [editing, setEditing] = useState(null);

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Qui accède à quoi. Le rôle détermine l'interface affichée."
        actions={
          <Button onClick={() => setEditing({ fullName: '', email: '', phone: '', password: '', role: 'staff' })}>
            <Plus size={15} /> Nouvel utilisateur
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        {isLoading ? <Spinner /> : (
          <Table
            rows={data?.data ?? []}
            onRowClick={(row) => setEditing({ ...row, password: '' })}
            empty="Aucun utilisateur."
            columns={[
              { key: 'fullName', header: 'Nom' },
              { key: 'email', header: 'Email' },
              { key: 'phone', header: 'Téléphone', render: (row) => row.phone ?? '—' },
              {
                key: 'role', header: 'Rôle',
                render: (row) => <Badge tone={ROLE_TONE[row.role]}>{ROLE_LABELS[row.role]}</Badge>,
              },
              {
                key: 'lastLoginAt', header: 'Dernière connexion', align: 'right',
                render: (row) => (row.lastLoginAt ? formatRelative(row.lastLoginAt) : 'Jamais'),
              },
              {
                key: 'isActive', header: 'État', align: 'right',
                render: (row) => <Badge tone={row.isActive ? 'ok' : 'danger'}>{row.isActive ? 'Actif' : 'Désactivé'}</Badge>,
              },
            ]}
          />
        )}
      </Card>

      {editing && <UserForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function UserForm({ initial, onClose }) {
  const [form, setForm] = useState({ isActive: true, ...initial });
  const [error, setError] = useState('');
  const save = useSaveUser();
  const isNew = !form.id;
  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const payload = {
      id: form.id, fullName: form.fullName, phone: form.phone || null, role: form.role,
      ...(isNew ? { email: form.email, password: form.password } : { isActive: form.isActive }),
      ...(!isNew && form.password ? { password: form.password } : {}),
    };
    try {
      await save.mutateAsync(payload);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Nouvel utilisateur' : 'Modifier l’utilisateur'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom complet">
          <Input required minLength={2} value={form.fullName} onChange={set('fullName')} autoFocus />
        </Field>

        <Field label="Adresse email">
          <Input type="email" required disabled={!isNew} value={form.email ?? ''} onChange={set('email')} />
        </Field>

        <Field label="Téléphone">
          <Input value={form.phone ?? ''} onChange={set('phone')} />
        </Field>

        <Field label="Rôle" hint="owner et manager voient l'interface admin, staff l'interface de service">
          <Select value={form.role} onChange={set('role')}>
            <option value="owner">Propriétaire</option>
            <option value="manager">Responsable</option>
            <option value="staff">Équipe</option>
          </Select>
        </Field>

        <Field
          label={isNew ? 'Mot de passe' : 'Nouveau mot de passe'}
          hint={isNew ? '10 caractères minimum' : 'Laisser vide pour ne pas changer'}
        >
          <Input type="password" minLength={10} required={isNew} value={form.password ?? ''} onChange={set('password')} />
        </Field>

        {!isNew && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
            Compte actif
          </label>
        )}

        <ErrorNote message={error} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={save.isPending}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
