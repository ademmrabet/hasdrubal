import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { ApiError, asyncHandler } from '../../utils/ApiError.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../utils/audit.js';

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

const COLUMNS = `id, name, contact_name AS "contactName", phone, email, address,
                 tax_id AS "taxId", payment_terms_days AS "paymentTermsDays",
                 notes, is_active AS "isActive", created_at AS "createdAt"`;

const bodySchema = z.object({
  name: z.string().trim().min(2, 'Nom requis'),
  contactName: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().toLowerCase().email('Email invalide').nullable().optional().or(z.literal('')),
  address: z.string().trim().nullable().optional(),
  taxId: z.string().trim().nullable().optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(0),
  notes: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
});

const idParam = z.object({ id: z.string().uuid('Identifiant invalide') });
const listQuery = z.object({
  search: z.string().trim().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

suppliersRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { search, includeInactive } = req.query;
    const { rows } = await query(
      `SELECT ${COLUMNS} FROM suppliers
        WHERE ($1::boolean OR is_active)
          AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%' OR contact_name ILIKE '%' || $2 || '%')
        ORDER BY name`,
      [includeInactive, search || null],
    );
    res.json({ data: rows });
  }),
);

suppliersRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT ${COLUMNS} FROM suppliers WHERE id = $1`, [req.params.id]);
    if (!rows[0]) throw ApiError.notFound('Fournisseur introuvable');
    res.json({ data: rows[0] });
  }),
);

suppliersRouter.post(
  '/',
  requireAdmin,
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO suppliers (name, contact_name, phone, email, address, tax_id, payment_terms_days, notes, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLUMNS}`,
      [b.name, b.contactName ?? null, b.phone ?? null, b.email || null, b.address ?? null,
       b.taxId ?? null, b.paymentTermsDays, b.notes ?? null, b.isActive],
    );
    await audit({ userId: req.user.id, action: 'create', entity: 'supplier', entityId: rows[0].id });
    res.status(201).json({ data: rows[0] });
  }),
);

suppliersRouter.put(
  '/:id',
  requireAdmin,
  validate({ params: idParam, body: bodySchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE suppliers SET name=$2, contact_name=$3, phone=$4, email=$5, address=$6,
              tax_id=$7, payment_terms_days=$8, notes=$9, is_active=$10
        WHERE id = $1 RETURNING ${COLUMNS}`,
      [req.params.id, b.name, b.contactName ?? null, b.phone ?? null, b.email || null, b.address ?? null,
       b.taxId ?? null, b.paymentTermsDays, b.notes ?? null, b.isActive],
    );
    if (!rows[0]) throw ApiError.notFound('Fournisseur introuvable');
    await audit({ userId: req.user.id, action: 'update', entity: 'supplier', entityId: req.params.id });
    res.json({ data: rows[0] });
  }),
);

// Desactivation plutot que suppression : l'historique d'achat doit rester lisible.
suppliersRouter.delete(
  '/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE suppliers SET is_active = false WHERE id = $1 RETURNING ${COLUMNS}`,
      [req.params.id],
    );
    if (!rows[0]) throw ApiError.notFound('Fournisseur introuvable');
    await audit({ userId: req.user.id, action: 'deactivate', entity: 'supplier', entityId: req.params.id });
    res.json({ data: rows[0] });
  }),
);
