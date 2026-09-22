import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/ApiError.js';
import { requireAuth, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../utils/audit.js';
import * as payroll from './payroll.service.js';

// Donnees sensibles (salaires, CNSS, CIN) : reserve au proprietaire, comme
// le module Utilisateurs. Un manager peut consulter les heures via le
// planning (module futur), pas les fiches de paie elles-memes.
export const payrollRouter = Router();
payrollRouter.use(requireAuth, requireOwner);

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const idParam = z.object({ id: z.string().uuid('Identifiant invalide') });

// --- Employes -------------------------------------------------------------

const employeeBodySchema = z.object({
  fullName: z.string().trim().min(2, 'Nom requis'),
  cin: z.string().trim().nullable().optional(),
  cnssNumber: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  birthDate: dateString.nullable().optional(),
  position: z.string().trim().nullable().optional(),
  contractType: z.enum(['cdi', 'cdd', 'stage', 'autre']).default('cdi'),
  contractEndDate: dateString.nullable().optional(),
  weeklyHoursRegime: z.coerce.number().int().refine((v) => v === 40 || v === 48, {
    message: 'Le régime hebdomadaire doit être 40 ou 48 heures',
  }),
  hireDate: dateString,
  terminationDate: dateString.nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().trim().nullable().optional(),
}).refine((v) => v.contractType !== 'cdd' || v.contractEndDate, {
  message: 'Indiquez la date de fin pour un CDD',
  path: ['contractEndDate'],
});

// A la creation uniquement : le salaire de depart, qui devient la premiere
// ligne de l'historique (motif "embauche").
const createEmployeeSchema = employeeBodySchema.and(z.object({
  baseSalaryMillimes: z.coerce.number().int().min(0, 'Salaire requis'),
}));

const listEmployeesQuery = z.object({
  search: z.string().trim().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

payrollRouter.get(
  '/employees',
  validate({ query: listEmployeesQuery }),
  asyncHandler(async (req, res) => {
    res.json({ data: await payroll.listEmployees(req.query) });
  }),
);

payrollRouter.get(
  '/employees/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await payroll.getEmployee(req.params.id) });
  }),
);

payrollRouter.post(
  '/employees',
  validate({ body: createEmployeeSchema }),
  asyncHandler(async (req, res) => {
    const created = await payroll.createEmployee(req.body, req.user.id);
    await audit({ userId: req.user.id, action: 'create', entity: 'employee', entityId: created.id });
    res.status(201).json({ data: created });
  }),
);

payrollRouter.put(
  '/employees/:id',
  validate({ params: idParam, body: employeeBodySchema }),
  asyncHandler(async (req, res) => {
    const updated = await payroll.updateEmployee(req.params.id, req.body);
    await audit({ userId: req.user.id, action: 'update', entity: 'employee', entityId: req.params.id });
    res.json({ data: updated });
  }),
);

payrollRouter.delete(
  '/employees/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await payroll.deactivateEmployee(req.params.id);
    await audit({ userId: req.user.id, action: 'deactivate', entity: 'employee', entityId: req.params.id });
    res.status(204).end();
  }),
);

// --- Historique de salaire (augmentations) ---------------------------------

const salaryChangeSchema = z.object({
  baseSalaryMillimes: z.coerce.number().int().min(0, 'Montant requis'),
  effectiveFrom: dateString,
  reason: z.string().trim().max(200).nullable().optional(),
});

payrollRouter.post(
  '/employees/:id/salary',
  validate({ params: idParam, body: salaryChangeSchema }),
  asyncHandler(async (req, res) => {
    const created = await payroll.addSalaryChange(req.params.id, req.body, req.user.id);
    await audit({ userId: req.user.id, action: 'create', entity: 'salary_history', entityId: created.id });
    res.status(201).json({ data: created });
  }),
);

// --- Avances sur salaire ----------------------------------------------------

const advanceSchema = z.object({
  amountMillimes: z.coerce.number().int().positive('Montant requis'),
  grantedAt: dateString,
  reason: z.string().trim().max(200).nullable().optional(),
});

payrollRouter.post(
  '/employees/:id/advances',
  validate({ params: idParam, body: advanceSchema }),
  asyncHandler(async (req, res) => {
    const created = await payroll.createAdvance(req.params.id, req.body, req.user.id);
    await audit({ userId: req.user.id, action: 'create', entity: 'salary_advance', entityId: created.id });
    res.status(201).json({ data: created });
  }),
);

payrollRouter.delete(
  '/advances/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await payroll.deleteAdvance(req.params.id);
    await audit({ userId: req.user.id, action: 'delete', entity: 'salary_advance', entityId: req.params.id });
    res.status(204).end();
  }),
);

// --- Fiches de paie ----------------------------------------------------------

const payslipBodySchema = z.object({
  employeeId: z.string().uuid('Employé requis'),
  periodStart: dateString,
  periodEnd: dateString,
  hoursWorked: z.coerce.number().min(0).nullable().optional(),
  overtimeHours: z.coerce.number().min(0).default(0),
  overtimeAmountMillimes: z.coerce.number().int().min(0).default(0),
  bonusMillimes: z.coerce.number().int().min(0).default(0),
  bonusNote: z.string().trim().max(200).nullable().optional(),
  irppMillimes: z.coerce.number().int().min(0).default(0),
  otherDeductionsMillimes: z.coerce.number().int().min(0).default(0),
  otherDeductionsNote: z.string().trim().max(200).nullable().optional(),
  advanceIds: z.array(z.string().uuid()).default([]),
  notes: z.string().trim().nullable().optional(),
});

const listPayslipsQuery = z.object({
  periodStart: dateString.optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['brouillon', 'validee', 'payee']).optional(),
});

payrollRouter.get(
  '/payslips',
  validate({ query: listPayslipsQuery }),
  asyncHandler(async (req, res) => {
    res.json({ data: await payroll.listPayslips(req.query) });
  }),
);

payrollRouter.get(
  '/payslips/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await payroll.getPayslip(req.params.id) });
  }),
);

payrollRouter.post(
  '/payslips',
  validate({ body: payslipBodySchema }),
  asyncHandler(async (req, res) => {
    const created = await payroll.createPayslip(req.body, req.user.id);
    await audit({ userId: req.user.id, action: 'create', entity: 'payslip', entityId: created.id });
    res.status(201).json({ data: created });
  }),
);

payrollRouter.patch(
  '/payslips/:id/status',
  validate({
    params: idParam,
    body: z.object({ status: z.enum(['brouillon', 'validee', 'payee']), paidAt: dateString.nullable().optional() }),
  }),
  asyncHandler(async (req, res) => {
    const updated = await payroll.setPayslipStatus(req.params.id, req.body.status, req.body.paidAt);
    await audit({ userId: req.user.id, action: 'update', entity: 'payslip', entityId: req.params.id });
    res.json({ data: updated });
  }),
);

payrollRouter.delete(
  '/payslips/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await payroll.deletePayslip(req.params.id);
    await audit({ userId: req.user.id, action: 'delete', entity: 'payslip', entityId: req.params.id });
    res.status(204).end();
  }),
);

// Le referentiel des taux (CNSS, TFP, FOPROLOS, SMIG) est expose via le
// module settings generique : GET/PUT /api/settings/payroll. Reutilise
// tel quel par le formulaire de fiche de paie cote client (useSetting).
