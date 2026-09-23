import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Settings, Trash2 } from 'lucide-react';
import {
  useAddAdvance, useAddSalaryChange, useCreatePayslip, useDeactivateEmployee, useDeleteAdvance,
  useDeletePayslip, useEmployee, useEmployees, usePayslip, usePayslips, useSaveEmployee, useSaveSetting,
  useSetPayslipStatus, useSetting,
} from '@/api/hooks';
import { errorMessage } from '@/api/client';
import {
  CONTRACT_TYPE_LABELS, formatDate, formatMonthLabel, formatPct, formatTND, monthToPeriod,
  PAYSLIP_STATUS_LABELS, toDinars, toMillimes,
} from '@/lib/format';
import { downloadPayslipPdf } from '@/lib/payslipPdf';
import {
  Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table,
} from '@/components/ui';

const PAYSLIP_STATUS_TONE = { brouillon: 'neutral', validee: 'brand', payee: 'ok' };

const EMPTY_EMPLOYEE = {
  fullName: '', position: '', cin: '', cnssNumber: '', phone: '', birthDate: '',
  contractType: 'cdi', contractEndDate: '', weeklyHoursRegime: 48,
  hireDate: new Date().toISOString().slice(0, 10), baseSalaryMillimes: '', notes: '', isActive: true,
};

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

export default function Payroll() {
  const [tab, setTab] = useState('employees');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [detailEmployeeId, setDetailEmployeeId] = useState(null);
  const [payslipForm, setPayslipForm] = useState(null); // null | { employeeId?: string }
  const [detailPayslipId, setDetailPayslipId] = useState(null);
  const [editingRates, setEditingRates] = useState(false);

  return (
    <>
      <PageHeader
        title="Paie"
        subtitle="Personnel, avances et fiches de paie — réservé au propriétaire"
        actions={
          <>
            <Button variant="ghost" onClick={() => setEditingRates(true)}>
              <Settings size={15} /> Taux de paie
            </Button>
            {tab === 'employees' ? (
              <Button onClick={() => setEditingEmployee({ ...EMPTY_EMPLOYEE })}>
                <Plus size={15} /> Nouvel employé
              </Button>
            ) : (
              <Button onClick={() => setPayslipForm({})}>
                <Plus size={15} /> Nouvelle fiche de paie
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 inline-flex rounded-[var(--radius-control)] border border-[var(--color-border)] p-1">
        {[['employees', 'Employés'], ['payslips', 'Fiches de paie']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              tab === key
                ? 'rounded-[calc(var(--radius-control)-2px)] bg-[var(--color-brand-soft)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)]'
                : 'px-3 py-1.5 text-sm text-[var(--color-ink-soft)]'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'employees' ? (
        <EmployeesTab onEdit={setEditingEmployee} onOpenDetail={setDetailEmployeeId} />
      ) : (
        <PayslipsTab onOpenDetail={setDetailPayslipId} />
      )}

      {editingEmployee && <EmployeeForm initial={editingEmployee} onClose={() => setEditingEmployee(null)} />}

      {detailEmployeeId && (
        <EmployeeDetail
          id={detailEmployeeId}
          onClose={() => setDetailEmployeeId(null)}
          onEdit={(row) => {
            setDetailEmployeeId(null);
            setEditingEmployee({
              id: row.id, fullName: row.fullName, position: row.position ?? '', cin: row.cin ?? '',
              cnssNumber: row.cnssNumber ?? '', phone: row.phone ?? '', birthDate: row.birthDate ?? '',
              contractType: row.contractType, contractEndDate: row.contractEndDate ?? '',
              weeklyHoursRegime: row.weeklyHoursRegime, hireDate: row.hireDate,
              terminationDate: row.terminationDate ?? '', notes: row.notes ?? '', isActive: row.isActive,
            });
          }}
          onNewPayslip={(employeeId) => {
            setDetailEmployeeId(null);
            setTab('payslips');
            setPayslipForm({ employeeId });
          }}
        />
      )}

      {payslipForm && (
        <PayslipForm
          presetEmployeeId={payslipForm.employeeId}
          onClose={() => setPayslipForm(null)}
        />
      )}

      {detailPayslipId && <PayslipDetail id={detailPayslipId} onClose={() => setDetailPayslipId(null)} />}

      {editingRates && <RatesForm onClose={() => setEditingRates(false)} />}
    </>
  );
}

/* ==================================================================== */
/* Employés                                                              */
/* ==================================================================== */
function EmployeesTab({ onEdit, onOpenDetail }) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useEmployees({ search: search || undefined, includeInactive });
  const rows = data?.data ?? [];

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input placeholder="Rechercher un employé" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="flex items-center gap-2 text-sm whitespace-nowrap px-1">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Inclure les comptes désactivés
          </label>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? <Spinner /> : (
          <Table
            rows={rows}
            onRowClick={(row) => onOpenDetail(row.id)}
            empty="Aucun employé enregistré."
            columns={[
              {
                key: 'fullName', header: 'Employé',
                render: (row) => (
                  <div>
                    <p className="font-medium">{row.fullName}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{row.position || 'Poste non renseigné'}</p>
                  </div>
                ),
              },
              {
                key: 'contractType', header: 'Contrat',
                render: (row) => `${CONTRACT_TYPE_LABELS[row.contractType]} · ${row.weeklyHoursRegime}h`,
              },
              {
                key: 'currentSalaryMillimes', header: 'Salaire de base', align: 'right',
                render: (row) => formatTND(row.currentSalaryMillimes),
              },
              {
                key: 'pendingAdvancesMillimes', header: 'Avances en attente', align: 'right',
                render: (row) => (row.pendingAdvancesMillimes > 0
                  ? <Badge tone="warn">{formatTND(row.pendingAdvancesMillimes)}</Badge>
                  : '—'),
              },
              {
                key: 'isActive', header: 'État', align: 'right',
                render: (row) => <Badge tone={row.isActive ? 'ok' : 'neutral'}>{row.isActive ? 'Actif' : 'Désactivé'}</Badge>,
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}

function EmployeeForm({ initial, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const save = useSaveEmployee();
  const isNew = !form.id;
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
        cin: form.cin || null,
        cnssNumber: form.cnssNumber || null,
        phone: form.phone || null,
        birthDate: form.birthDate || null,
        contractEndDate: form.contractType === 'cdd' ? form.contractEndDate : null,
        weeklyHoursRegime: Number(form.weeklyHoursRegime),
        notes: form.notes || null,
        ...(isNew ? { baseSalaryMillimes: toMillimes(form.baseSalaryMillimes) } : {}),
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Nouvel employé' : 'Modifier l’employé'} width="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom complet">
            <Input required minLength={2} value={form.fullName} onChange={set('fullName')} autoFocus />
          </Field>
          <Field label="Poste" hint="Ex. serveur, cuisinier, plongeur">
            <Input value={form.position} onChange={set('position')} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CIN">
            <Input value={form.cin} onChange={set('cin')} />
          </Field>
          <Field label="Matricule CNSS">
            <Input value={form.cnssNumber} onChange={set('cnssNumber')} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Téléphone">
            <Input value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Date de naissance">
            <Input type="date" value={form.birthDate} onChange={set('birthDate')} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type de contrat">
            <Select value={form.contractType} onChange={set('contractType')}>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Régime hebdomadaire">
            <Select value={form.weeklyHoursRegime} onChange={set('weeklyHoursRegime')}>
              <option value={48}>48 heures</option>
              <option value={40}>40 heures</option>
            </Select>
          </Field>
        </div>

        {form.contractType === 'cdd' && (
          <Field label="Date de fin de contrat">
            <Input type="date" required value={form.contractEndDate} onChange={set('contractEndDate')} />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date d'embauche">
            <Input type="date" required value={form.hireDate} onChange={set('hireDate')} />
          </Field>
          {isNew ? (
            <Field label="Salaire de base (DT/mois)" hint="Brut de départ, avant CNSS et primes">
              <Input type="number" min="0" step="0.001" required
                     value={form.baseSalaryMillimes} onChange={set('baseSalaryMillimes')} />
            </Field>
          ) : (
            <div className="flex items-end pb-2 text-xs text-[var(--color-ink-faint)]">
              Pour changer le salaire, utilisez « Ajouter une évolution » dans la fiche employé.
            </div>
          )}
        </div>

        <Field label="Notes (optionnel)">
          <Input value={form.notes} onChange={set('notes')} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
          Compte actif
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

function EmployeeDetail({ id, onClose, onEdit, onNewPayslip }) {
  const { data, isLoading } = useEmployee(id);
  const deactivate = useDeactivateEmployee();
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');
  const row = data?.data;

  const doDeactivate = async () => {
    setDeactivateError('');
    try {
      await deactivate.mutateAsync(id);
      onClose();
    } catch (err) {
      setDeactivateError(errorMessage(err, 'Désactivation impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title={row?.fullName ?? 'Employé'} width="max-w-2xl">
      {isLoading || !row ? <Spinner /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Stat label="Poste" value={row.position || '—'} />
            <Stat label="Contrat" value={`${CONTRACT_TYPE_LABELS[row.contractType]} · ${row.weeklyHoursRegime}h`} />
            <Stat label="Salaire de base" value={formatTND(row.currentSalaryMillimes)} />
            <Stat
              label="Avances en attente"
              value={formatTND(row.advances.filter((a) => !a.payslipId).reduce((s, a) => s + a.amountMillimes, 0))}
            />
          </div>

          <SalaryHistorySection employeeId={id} history={row.salaryHistory} />
          <AdvancesSection employeeId={id} advances={row.advances} />

          <section className="border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Fiches de paie</h3>
              <Button variant="secondary" onClick={() => onNewPayslip(id)}>
                <Plus size={15} /> Nouvelle fiche
              </Button>
            </div>
            {row.payslips.length ? (
              <Table
                rows={row.payslips}
                empty="Aucune fiche de paie."
                columns={[
                  { key: 'periodStart', header: 'Période', render: (p) => formatMonthLabel(p.periodStart) },
                  { key: 'grossMillimes', header: 'Brut', align: 'right', render: (p) => formatTND(p.grossMillimes) },
                  { key: 'netMillimes', header: 'Net', align: 'right', render: (p) => formatTND(p.netMillimes) },
                  {
                    key: 'status', header: 'Statut', align: 'right',
                    render: (p) => <Badge tone={PAYSLIP_STATUS_TONE[p.status]}>{PAYSLIP_STATUS_LABELS[p.status]}</Badge>,
                  },
                ]}
              />
            ) : (
              <EmptyState message="Aucune fiche de paie émise pour le moment." />
            )}
          </section>

          <section className="border-t border-[var(--color-border)] pt-4">
            {!confirmingDeactivate ? (
              row.isActive && (
                <Button variant="ghost" onClick={() => setConfirmingDeactivate(true)}>
                  Désactiver ce compte
                </Button>
              )
            ) : (
              <div className="rounded-[var(--radius-control)] bg-[var(--color-danger-soft)] p-3">
                <p className="text-sm text-[var(--color-danger)] mb-2">
                  L'employé ne sera plus proposé pour de nouvelles fiches de paie. L'historique est conservé.
                </p>
                <ErrorNote message={deactivateError} />
                <div className="flex gap-2 mt-2">
                  <Button variant="secondary" onClick={() => setConfirmingDeactivate(false)}>Annuler</Button>
                  <Button variant="danger" loading={deactivate.isPending} onClick={doDeactivate}>Confirmer</Button>
                </div>
              </div>
            )}
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

function SalaryHistorySection({ employeeId, history }) {
  const addChange = useAddSalaryChange();
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await addChange.mutateAsync({ id: employeeId, baseSalaryMillimes: toMillimes(amount), effectiveFrom, reason: reason || null });
      setMessage('Évolution de salaire enregistrée.');
      setAmount('');
      setReason('');
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  return (
    <section className="border-t border-[var(--color-border)] pt-4">
      <h3 className="text-sm font-semibold mb-2">Historique de salaire</h3>
      <Table
        rows={history}
        empty="Aucun historique."
        columns={[
          { key: 'effectiveFrom', header: 'Depuis', render: (h) => formatDate(h.effectiveFrom) },
          { key: 'baseSalaryMillimes', header: 'Montant', align: 'right', render: (h) => formatTND(h.baseSalaryMillimes) },
          { key: 'reason', header: 'Motif', render: (h) => h.reason ?? '—' },
        ]}
      />
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Field label="Nouveau salaire (DT)">
            <Input type="number" min="0" step="0.001" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        <div className="w-40">
          <Field label="À partir du">
            <Input type="date" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
        </div>
        <div className="flex-1 min-w-[160px]">
          <Field label="Motif (optionnel)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. augmentation annuelle" />
          </Field>
        </div>
        <Button type="submit" variant="secondary" loading={addChange.isPending}>Ajouter</Button>
      </form>
      {message && <p className="mt-2 text-sm text-[var(--color-ok)]">{message}</p>}
      <div className="mt-2"><ErrorNote message={error} /></div>
    </section>
  );
}

function AdvancesSection({ employeeId, advances }) {
  const addAdvance = useAddAdvance();
  const deleteAdvance = useDeleteAdvance();
  const [amount, setAmount] = useState('');
  const [grantedAt, setGrantedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await addAdvance.mutateAsync({ id: employeeId, amountMillimes: toMillimes(amount), grantedAt, reason: reason || null });
      setAmount('');
      setReason('');
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  return (
    <section className="border-t border-[var(--color-border)] pt-4">
      <h3 className="text-sm font-semibold mb-2">Avances sur salaire</h3>
      <Table
        rows={advances}
        empty="Aucune avance enregistrée."
        columns={[
          { key: 'grantedAt', header: 'Date', render: (a) => formatDate(a.grantedAt) },
          { key: 'amountMillimes', header: 'Montant', align: 'right', render: (a) => formatTND(a.amountMillimes) },
          { key: 'reason', header: 'Motif', render: (a) => a.reason ?? '—' },
          {
            key: 'status', header: 'Statut', align: 'right',
            render: (a) => (a.payslipId
              ? <Badge tone="ok">Déduite</Badge>
              : (
                <div className="flex items-center justify-end gap-2">
                  <Badge tone="warn">En attente</Badge>
                  <button
                    type="button"
                    aria-label="Annuler l'avance"
                    className="text-[var(--color-ink-faint)] hover:text-[var(--color-danger)]"
                    onClick={() => deleteAdvance.mutate(a.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )),
          },
        ]}
      />
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Field label="Montant (DT)">
            <Input type="number" min="0" step="0.001" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Date">
            <Input type="date" required value={grantedAt} onChange={(e) => setGrantedAt(e.target.value)} />
          </Field>
        </div>
        <div className="flex-1 min-w-[160px]">
          <Field label="Motif (optionnel)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. dépannage" />
          </Field>
        </div>
        <Button type="submit" variant="secondary" loading={addAdvance.isPending}>Enregistrer</Button>
      </form>
      <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
        Une avance en attente sera proposée automatiquement à la déduction lors de la prochaine fiche de paie de cet employé.
      </p>
      <div className="mt-2"><ErrorNote message={error} /></div>
    </section>
  );
}

/* ==================================================================== */
/* Fiches de paie                                                        */
/* ==================================================================== */
function PayslipsTab({ onOpenDetail }) {
  const [filters, setFilters] = useState({ employeeId: '', month: '', status: '' });
  const { data: employees } = useEmployees({ includeInactive: true });
  const period = filters.month ? monthToPeriod(filters.month) : null;
  const { data, isLoading } = usePayslips({
    employeeId: filters.employeeId || undefined,
    periodStart: period?.periodStart,
    status: filters.status || undefined,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={filters.employeeId} onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}>
            <option value="">Tous les employés</option>
            {employees?.data?.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </Select>
          <Input type="month" value={filters.month} onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))} />
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Tous les statuts</option>
            {Object.entries(PAYSLIP_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading ? <Spinner /> : (
          <Table
            rows={rows}
            onRowClick={(row) => onOpenDetail(row.id)}
            empty="Aucune fiche de paie ne correspond à ces filtres."
            columns={[
              { key: 'employeeName', header: 'Employé', render: (p) => p.employeeName },
              { key: 'periodStart', header: 'Période', render: (p) => formatMonthLabel(p.periodStart) },
              { key: 'grossMillimes', header: 'Brut', align: 'right', render: (p) => formatTND(p.grossMillimes) },
              { key: 'netMillimes', header: 'Net à payer', align: 'right', render: (p) => formatTND(p.netMillimes) },
              {
                key: 'status', header: 'Statut', align: 'right',
                render: (p) => (
                  <div className="flex items-center justify-end gap-2">
                    {p.belowSmig && <Badge tone="danger">Sous SMIG</Badge>}
                    <Badge tone={PAYSLIP_STATUS_TONE[p.status]}>{PAYSLIP_STATUS_LABELS[p.status]}</Badge>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}

/** Reproduit le calcul serveur pour un apercu instantane avant envoi. */
function computePreview({ baseSalaryMillimes, overtimeMillimes, bonusMillimes, irppMillimes, advancesMillimes, rates, weeklyHoursRegime }) {
  const gross = baseSalaryMillimes + overtimeMillimes + bonusMillimes;
  const pct = (amount, rate) => Math.round((amount * rate) / 100);
  const cnssEmployee = pct(gross, rates.cnssEmployeeRatePct);
  const cnssEmployer = pct(gross, rates.cnssEmployerRatePct);
  const tfp = pct(gross, rates.tfpRatePct);
  const foprolos = pct(gross, rates.foprolosRatePct);
  const net = gross - cnssEmployee - irppMillimes - advancesMillimes;
  const employerCost = gross + cnssEmployer + tfp + foprolos;
  const smigThreshold = weeklyHoursRegime === 40 ? rates.smig40hMillimes : rates.smig48hMillimes;
  return { gross, cnssEmployee, cnssEmployer, tfp, foprolos, net, employerCost, belowSmig: baseSalaryMillimes < smigThreshold };
}

const DEFAULT_RATES = {
  cnssEmployeeRatePct: 9.68, cnssEmployerRatePct: 17.07, tfpRatePct: 1, foprolosRatePct: 1,
  smig48hMillimes: 554736, smig40hMillimes: 470251,
};

function PayslipForm({ presetEmployeeId, onClose }) {
  const { data: employeesData } = useEmployees({ includeInactive: true });
  const [employeeId, setEmployeeId] = useState(presetEmployeeId ?? '');
  const { data: employeeData } = useEmployee(employeeId);
  const { data: ratesData } = useSetting('payroll');
  const create = useCreatePayslip();

  const [month, setMonth] = useState(currentMonthValue());
  const [hoursWorked, setHoursWorked] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [overtimeAmount, setOvertimeAmount] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusNote, setBonusNote] = useState('');
  const [irppAmount, setIrppAmount] = useState('');
  const [irppPct, setIrppPct] = useState('');
  const [selectedAdvanceIds, setSelectedAdvanceIds] = useState(new Set());
  const [error, setError] = useState('');

  const employee = employeeData?.data;
  const pendingAdvances = useMemo(() => employee?.advances?.filter((a) => !a.payslipId) ?? [], [employee]);

  // Une nouvelle avance en attente est selectionnee par defaut : c'est ce qui
  // fait que « logger une avance » se traduit, a la prochaine fiche, par une
  // deduction automatique — l'utilisateur peut toujours decocher au cas par cas.
  useEffect(() => {
    setSelectedAdvanceIds(new Set(pendingAdvances.map((a) => a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, employee?.advances?.length]);

  const rates = ratesData?.data ?? DEFAULT_RATES;
  const baseSalaryMillimes = employee?.currentSalaryMillimes ?? 0;
  const overtimeMillimes = toMillimes(overtimeAmount);
  const bonusMillimes = toMillimes(bonusAmount);
  const irppMillimes = toMillimes(irppAmount);
  const advancesMillimes = pendingAdvances
    .filter((a) => selectedAdvanceIds.has(a.id))
    .reduce((s, a) => s + a.amountMillimes, 0);

  const preview = employee ? computePreview({
    baseSalaryMillimes, overtimeMillimes, bonusMillimes, irppMillimes, advancesMillimes,
    rates, weeklyHoursRegime: employee.weeklyHoursRegime,
  }) : null;

  const onIrppPctChange = (value) => {
    setIrppPct(value);
    if (preview && value !== '') {
      const grossNow = baseSalaryMillimes + overtimeMillimes + bonusMillimes;
      setIrppAmount(toDinars(Math.round((grossNow * Number(value)) / 100)).toString());
    }
  };

  const toggleAdvance = (id) => setSelectedAdvanceIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { periodStart, periodEnd } = monthToPeriod(month);
      await create.mutateAsync({
        employeeId,
        periodStart,
        periodEnd,
        hoursWorked: hoursWorked === '' ? null : Number(hoursWorked),
        overtimeHours: overtimeHours === '' ? 0 : Number(overtimeHours),
        overtimeAmountMillimes: overtimeMillimes,
        bonusMillimes,
        bonusNote: bonusNote || null,
        irppMillimes,
        advanceIds: [...selectedAdvanceIds],
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Création impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title="Nouvelle fiche de paie" width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Employé">
            {presetEmployeeId ? (
              <p className="input flex items-center bg-[var(--color-surface-muted)]">{employee?.fullName ?? '…'}</p>
            ) : (
              <Select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Choisir…</option>
                {employeesData?.data?.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Période">
            <Input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
        </div>

        {employeeId && !employee && <Spinner />}

        {employee && (
          <>
            <p className="text-xs text-[var(--color-ink-faint)]">
              Salaire de base : <span className="font-medium text-[var(--color-ink)]">{formatTND(baseSalaryMillimes)}</span>
              {' '}— fixé par le dernier changement de salaire enregistré, avant la période choisie.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Heures travaillées (optionnel)">
                <Input type="number" min="0" step="0.5" value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)} />
              </Field>
              <Field label="Heures supplémentaires (optionnel)">
                <Input type="number" min="0" step="0.5" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} />
              </Field>
            </div>
            <Field label="Montant des heures supplémentaires (DT)" hint="Majoration à saisir manuellement">
              <Input type="number" min="0" step="0.001" value={overtimeAmount} onChange={(e) => setOvertimeAmount(e.target.value)} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prime (DT)">
                <Input type="number" min="0" step="0.001" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} />
              </Field>
              <Field label="Motif de la prime (optionnel)">
                <Input value={bonusNote} onChange={(e) => setBonusNote(e.target.value)} placeholder="Ex. bonne performance" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Impôt sur le revenu à retenir — IRPP (DT)" hint="Saisie manuelle : le barème n'est pas calculé automatiquement">
                <Input type="number" min="0" step="0.001" value={irppAmount}
                       onChange={(e) => { setIrppAmount(e.target.value); setIrppPct(''); }} />
              </Field>
              <Field label="ou en % du brut">
                <Input type="number" min="0" step="0.1" value={irppPct} onChange={(e) => onIrppPctChange(e.target.value)} />
              </Field>
            </div>

            <section>
              <h3 className="text-sm font-semibold mb-2">Avances à déduire cette fiche</h3>
              {pendingAdvances.length ? (
                <div className="space-y-1.5">
                  {pendingAdvances.map((a) => (
                    <label key={a.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedAdvanceIds.has(a.id)} onChange={() => toggleAdvance(a.id)} />
                        {formatDate(a.grantedAt)} {a.reason ? `— ${a.reason}` : ''}
                      </span>
                      <span className="tabular font-medium">{formatTND(a.amountMillimes)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-ink-faint)]">Aucune avance en attente pour cet employé.</p>
              )}
            </section>

            {preview && (
              <section className="rounded-[var(--radius-control)] border border-[var(--color-border)] p-3 space-y-1.5 text-sm">
                <PreviewLine label="Salaire de base" value={baseSalaryMillimes} />
                {overtimeMillimes > 0 && <PreviewLine label="Heures supplémentaires" value={overtimeMillimes} sign="+" />}
                {bonusMillimes > 0 && <PreviewLine label="Prime" value={bonusMillimes} sign="+" />}
                <PreviewLine label="Brut" value={preview.gross} strong />
                <PreviewLine label={`CNSS salarié (${formatPct(rates.cnssEmployeeRatePct)})`} value={preview.cnssEmployee} sign="−" />
                {irppMillimes > 0 && <PreviewLine label="IRPP" value={irppMillimes} sign="−" />}
                {advancesMillimes > 0 && <PreviewLine label="Avances déduites" value={advancesMillimes} sign="−" />}
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 text-base font-semibold">
                  <span>Net à payer</span>
                  <span className="tabular">{formatTND(preview.net)}</span>
                </div>
                <p className="text-xs text-[var(--color-ink-faint)] pt-1">
                  Coût employeur total (CNSS patronale, TFP, FOPROLOS inclus) : {formatTND(preview.employerCost)}
                </p>
                {preview.belowSmig && (
                  <p className="text-xs text-[var(--color-danger)]">
                    Le salaire de base est en dessous du SMIG applicable pour ce régime horaire.
                  </p>
                )}
              </section>
            )}
          </>
        )}

        <ErrorNote message={error} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!employee} loading={create.isPending}>Créer la fiche</Button>
        </div>
      </form>
    </Modal>
  );
}

const PreviewLine = ({ label, value, sign = '', strong = false }) => (
  <div className={`flex items-center justify-between ${strong ? 'font-medium' : 'text-[var(--color-ink-soft)]'}`}>
    <span>{label}</span>
    <span className="tabular">{sign}{formatTND(value)}</span>
  </div>
);

function PayslipDetail({ id, onClose }) {
  const { data, isLoading } = usePayslip(id);
  const setStatus = useSetPayslipStatus();
  const del = useDeletePayslip();
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [markingPaid, setMarkingPaid] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const p = data?.data;

  const changeStatus = async (status, extra = {}) => {
    setError('');
    try {
      await setStatus.mutateAsync({ id, status, ...extra });
      setMarkingPaid(false);
    } catch (err) {
      setError(errorMessage(err, 'Action impossible'));
    }
  };

  const downloadPdf = async () => {
    setError('');
    setPdfLoading(true);
    try {
      await downloadPayslipPdf(p);
    } catch (err) {
      setError(errorMessage(err, 'Génération du PDF impossible'));
    } finally {
      setPdfLoading(false);
    }
  };

  const doDelete = async () => {
    setError('');
    try {
      await del.mutateAsync(id);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Suppression impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title={p ? `${p.employeeFullName} — ${formatMonthLabel(p.periodStart)}` : 'Fiche de paie'} width="max-w-lg">
      {isLoading || !p ? <Spinner /> : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={PAYSLIP_STATUS_TONE[p.status]}>{PAYSLIP_STATUS_LABELS[p.status]}</Badge>
              {p.belowSmig && <Badge tone="danger">Sous SMIG</Badge>}
              {p.paidAt && <span className="text-xs text-[var(--color-ink-faint)]">Payée le {formatDate(p.paidAt)}</span>}
            </div>
            <Button variant="secondary" loading={pdfLoading} onClick={downloadPdf}>
              <Download size={15} /> Télécharger en PDF
            </Button>
          </div>

          <p className="text-xs text-[var(--color-ink-faint)]">
            {p.employeePosition || 'Poste non renseigné'}
            {p.employeeCnssNumber ? ` · CNSS ${p.employeeCnssNumber}` : ''}
          </p>

          <section className="rounded-[var(--radius-control)] border border-[var(--color-border)] p-3 space-y-1.5 text-sm">
            <PreviewLine label="Salaire de base" value={p.baseSalaryMillimes} />
            {p.overtimeAmountMillimes > 0 && <PreviewLine label="Heures supplémentaires" value={p.overtimeAmountMillimes} sign="+" />}
            {p.bonusMillimes > 0 && <PreviewLine label={p.bonusNote ? `Prime — ${p.bonusNote}` : 'Prime'} value={p.bonusMillimes} sign="+" />}
            <PreviewLine label="Brut" value={p.grossMillimes} strong />
            <PreviewLine label={`CNSS salarié (${formatPct(p.cnssEmployeeRatePct)})`} value={p.cnssEmployeeMillimes} sign="−" />
            {p.irppMillimes > 0 && <PreviewLine label="IRPP" value={p.irppMillimes} sign="−" />}
            {p.otherDeductionsMillimes > 0 && (
              <PreviewLine label={p.otherDeductionsNote || 'Autres retenues'} value={p.otherDeductionsMillimes} sign="−" />
            )}
            {p.advancesMillimes > 0 && <PreviewLine label="Avances déduites" value={p.advancesMillimes} sign="−" />}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 text-base font-semibold">
              <span>Net à payer</span>
              <span className="tabular">{formatTND(p.netMillimes)}</span>
            </div>
            <p className="text-xs text-[var(--color-ink-faint)] pt-1">
              Coût employeur total : {formatTND(p.employerCostMillimes)}
            </p>
          </section>

          {p.deductedAdvances.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-1.5">Avances déduites sur cette fiche</h3>
              <ul className="space-y-1 text-sm text-[var(--color-ink-soft)]">
                {p.deductedAdvances.map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span>{formatDate(a.grantedAt)} {a.reason ? `— ${a.reason}` : ''}</span>
                    <span className="tabular">{formatTND(a.amountMillimes)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ErrorNote message={error} />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-4">
            <div className="flex gap-2">
              {p.status === 'brouillon' && !confirmingDelete && (
                <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>Supprimer</Button>
              )}
              {confirmingDelete && (
                <>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>Annuler</Button>
                  <Button variant="danger" loading={del.isPending} onClick={doDelete}>Confirmer la suppression</Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {p.status === 'brouillon' && (
                <Button loading={setStatus.isPending} onClick={() => changeStatus('validee')}>Valider</Button>
              )}
              {p.status === 'validee' && !markingPaid && (
                <Button onClick={() => setMarkingPaid(true)}>Marquer payée</Button>
              )}
              {markingPaid && (
                <>
                  <Input type="date" className="w-40" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                  <Button loading={setStatus.isPending} onClick={() => changeStatus('payee', { paidAt })}>Confirmer</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ==================================================================== */
/* Taux de paie                                                          */
/* ==================================================================== */
function RatesForm({ onClose }) {
  const { data, isLoading } = useSetting('payroll');
  const save = useSaveSetting('payroll');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (data?.data) setForm(data.data);
  }, [data]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await save.mutateAsync({
        cnssEmployeeRatePct: Number(form.cnssEmployeeRatePct),
        cnssEmployerRatePct: Number(form.cnssEmployerRatePct),
        tfpRatePct: Number(form.tfpRatePct),
        foprolosRatePct: Number(form.foprolosRatePct),
        smig48hMillimes: toMillimes(toDinars(form.smig48hMillimes)),
        smig40hMillimes: toMillimes(toDinars(form.smig40hMillimes)),
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible'));
    }
  };

  return (
    <Modal open onClose={onClose} title="Taux de paie">
      {isLoading || !form ? <Spinner /> : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-[var(--color-ink-soft)]">
            Ces taux s'appliquent à toute nouvelle fiche de paie. Une fiche déjà émise garde les taux en vigueur
            au moment de sa création.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CNSS salarié (%)">
              <Input type="number" min="0" step="0.01" value={form.cnssEmployeeRatePct} onChange={set('cnssEmployeeRatePct')} />
            </Field>
            <Field label="CNSS employeur (%)">
              <Input type="number" min="0" step="0.01" value={form.cnssEmployerRatePct} onChange={set('cnssEmployerRatePct')} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="TFP (%)" hint="Charge patronale uniquement">
              <Input type="number" min="0" step="0.01" value={form.tfpRatePct} onChange={set('tfpRatePct')} />
            </Field>
            <Field label="FOPROLOS (%)" hint="Charge patronale uniquement">
              <Input type="number" min="0" step="0.01" value={form.foprolosRatePct} onChange={set('foprolosRatePct')} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SMIG régime 48h (DT/mois)">
              <Input type="number" min="0" step="0.001" value={toDinars(form.smig48hMillimes)}
                     onChange={(e) => setForm((f) => ({ ...f, smig48hMillimes: toMillimes(e.target.value) }))} />
            </Field>
            <Field label="SMIG régime 40h (DT/mois)">
              <Input type="number" min="0" step="0.001" value={toDinars(form.smig40hMillimes)}
                     onChange={(e) => setForm((f) => ({ ...f, smig40hMillimes: toMillimes(e.target.value) }))} />
            </Field>
          </div>

          <ErrorNote message={error} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" loading={save.isPending}>Enregistrer</Button>
          </div>
        </form>
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
