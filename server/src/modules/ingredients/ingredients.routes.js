import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { ApiError, asyncHandler } from '../../utils/ApiError.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../utils/audit.js';

export const ingredientsRouter = Router();
ingredientsRouter.use(requireAuth);

export const UNITS = ['kg', 'g', 'l', 'ml', 'piece', 'botte', 'boite', 'bouteille'];

const STOCK_COLUMNS = `id, name, unit, category_id AS "categoryId", category_name AS "categoryName",
  default_supplier_id AS "defaultSupplierId", supplier_name AS "supplierName",
  min_threshold AS "minThreshold", target_stock AS "targetStock",
  is_perishable AS "isPerishable", is_active AS "isActive",
  avg_cost_millimes AS "avgCostMillimes", current_qty AS "currentQty",
  stock_value_millimes AS "stockValueMillimes", suggested_reorder_qty AS "suggestedReorderQty",
  stock_status AS "stockStatus", next_expiry AS "nextExpiry"`;

const bodySchema = z.object({
  name: z.string().trim().min(2, 'Nom requis'),
  categoryId: z.string().uuid().nullable().optional(),
  unit: z.enum(UNITS),
  minThreshold: z.coerce.number().min(0).default(0),
  targetStock: z.coerce.number().min(0).default(0),
  isPerishable: z.boolean().default(false),
  shelfLifeDays: z.coerce.number().int().min(1).nullable().optional(),
  defaultSupplierId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
}).refine((v) => !v.isPerishable || v.shelfLifeDays != null, {
  message: 'Indiquez la durée de conservation pour un produit périssable',
  path: ['shelfLifeDays'],
});

const idParam = z.object({ id: z.string().uuid('Identifiant invalide') });
const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid('Identifiant invalide')).min(1, 'Aucun ingrédient sélectionné').max(500),
});
const costSchema = z.object({
  avgCostMillimes: z.coerce.number().int().min(0, 'Coût invalide'),
  reason: z.string().trim().max(200).nullable().optional(),
});
const listQuery = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['ok', 'bas', 'rupture']).optional(),
  includeInactive: z.coerce.boolean().default(false),
});

// --- Categories -------------------------------------------------------
ingredientsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.name, c.sort_order AS "sortOrder",
              count(i.id)::int AS "ingredientCount"
         FROM ingredient_categories c
         LEFT JOIN ingredients i ON i.category_id = c.id AND i.is_active
        GROUP BY c.id ORDER BY c.sort_order, c.name`,
    );
    res.json({ data: rows });
  }),
);

ingredientsRouter.post(
  '/categories',
  requireAdmin,
  validate({ body: z.object({ name: z.string().trim().min(2), sortOrder: z.coerce.number().int().default(0) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `INSERT INTO ingredient_categories (name, sort_order) VALUES ($1, $2)
       RETURNING id, name, sort_order AS "sortOrder"`,
      [req.body.name, req.body.sortOrder],
    );
    res.status(201).json({ data: rows[0] });
  }),
);

// --- Ingredients ------------------------------------------------------
ingredientsRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { search, categoryId, status, includeInactive } = req.query;
    const { rows } = await query(
      `SELECT ${STOCK_COLUMNS} FROM v_ingredient_stock
        WHERE ($1::boolean OR is_active)
          AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
          AND ($3::uuid IS NULL OR category_id = $3)
          AND ($4::text IS NULL OR stock_status = $4)
        ORDER BY
          CASE stock_status WHEN 'rupture' THEN 0 WHEN 'bas' THEN 1 ELSE 2 END,
          name`,
      [includeInactive, search || null, categoryId || null, status || null],
    );
    res.json({ data: rows });
  }),
);

ingredientsRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT ${STOCK_COLUMNS} FROM v_ingredient_stock WHERE id = $1`, [req.params.id]);
    if (!rows[0]) throw ApiError.notFound('Ingrédient introuvable');

    const batches = await query(
      `SELECT b.id, b.batch_code AS "batchCode", b.quantity_received AS "quantityReceived",
              b.quantity_remaining AS "quantityRemaining", b.unit_cost_millimes AS "unitCostMillimes",
              b.received_at AS "receivedAt", b.expires_at AS "expiresAt", s.name AS "supplierName"
         FROM stock_batches b
         LEFT JOIN suppliers s ON s.id = b.supplier_id
        WHERE b.ingredient_id = $1 AND b.quantity_remaining > 0
        ORDER BY b.expires_at NULLS LAST, b.received_at`,
      [req.params.id],
    );
    res.json({ data: { ...rows[0], batches: batches.rows } });
  }),
);

ingredientsRouter.post(
  '/',
  requireAdmin,
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO ingredients (name, category_id, unit, min_threshold, target_stock,
                                is_perishable, shelf_life_days, default_supplier_id, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [b.name, b.categoryId ?? null, b.unit, b.minThreshold, b.targetStock,
       b.isPerishable, b.shelfLifeDays ?? null, b.defaultSupplierId ?? null, b.isActive],
    );
    await audit({ userId: req.user.id, action: 'create', entity: 'ingredient', entityId: rows[0].id });
    const created = await query(`SELECT ${STOCK_COLUMNS} FROM v_ingredient_stock WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ data: created.rows[0] });
  }),
);

ingredientsRouter.put(
  '/:id',
  requireAdmin,
  validate({ params: idParam, body: bodySchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rowCount } = await query(
      `UPDATE ingredients SET name=$2, category_id=$3, unit=$4, min_threshold=$5, target_stock=$6,
              is_perishable=$7, shelf_life_days=$8, default_supplier_id=$9, is_active=$10
        WHERE id = $1`,
      [req.params.id, b.name, b.categoryId ?? null, b.unit, b.minThreshold, b.targetStock,
       b.isPerishable, b.shelfLifeDays ?? null, b.defaultSupplierId ?? null, b.isActive],
    );
    if (!rowCount) throw ApiError.notFound('Ingrédient introuvable');
    await audit({ userId: req.user.id, action: 'update', entity: 'ingredient', entityId: req.params.id });
    const updated = await query(`SELECT ${STOCK_COLUMNS} FROM v_ingredient_stock WHERE id = $1`, [req.params.id]);
    res.json({ data: updated.rows[0] });
  }),
);

// Correction du cout moyen en dehors de toute reception : le prix d'un
// fournisseur a change et l'owner/manager veut que les marges de la carte
// le refletent tout de suite, sans attendre (ou fabriquer) une livraison.
// N'affecte JAMAIS les lots deja receptionnes (stock_batches.unit_cost_millimes,
// donc ni la valeur de stock ni le cout des sorties passees) : seule la
// reference utilisee pour le cout des NOUVELLES fiches techniques change.
// Tracee dans le journal d'audit (valeur avant/apres), pas comme un mouvement
// de stock puisqu'aucune quantite ne bouge.
ingredientsRouter.patch(
  '/:id/cost',
  requireAdmin,
  validate({ params: idParam, body: costSchema }),
  asyncHandler(async (req, res) => {
    const before = await query('SELECT avg_cost_millimes FROM ingredients WHERE id = $1', [req.params.id]);
    if (!before.rowCount) throw ApiError.notFound('Ingrédient introuvable');

    await query('UPDATE ingredients SET avg_cost_millimes = $2 WHERE id = $1',
      [req.params.id, req.body.avgCostMillimes]);

    await audit({
      userId: req.user.id, action: 'update_cost', entity: 'ingredient', entityId: req.params.id,
      payload: {
        fromMillimes: before.rows[0].avg_cost_millimes,
        toMillimes: req.body.avgCostMillimes,
        reason: req.body.reason ?? null,
      },
    });
    const updated = await query(`SELECT ${STOCK_COLUMNS} FROM v_ingredient_stock WHERE id = $1`, [req.params.id]);
    res.json({ data: updated.rows[0] });
  }),
);

ingredientsRouter.delete(
  '/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('UPDATE ingredients SET is_active = false WHERE id = $1', [req.params.id]);
    if (!rowCount) throw ApiError.notFound('Ingrédient introuvable');
    await audit({ userId: req.user.id, action: 'deactivate', entity: 'ingredient', entityId: req.params.id });
    res.status(204).end();
  }),
);

// Suppression groupee : desactive plusieurs ingredients d'un coup (case a cocher
// dans le tableau). Meme comportement que la suppression individuelle - un
// ingredient reste retrouvable dans l'historique des mouvements et des fiches
// techniques passees, seulement retire des listes actives et du menu.
ingredientsRouter.delete(
  '/',
  requireAdmin,
  validate({ body: bulkIdsSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `UPDATE ingredients SET is_active = false
        WHERE id = ANY($1::uuid[]) AND is_active
        RETURNING id`,
      [req.body.ids],
    );
    for (const row of rows) {
      await audit({ userId: req.user.id, action: 'deactivate', entity: 'ingredient', entityId: row.id });
    }
    res.json({ data: { deactivatedCount: rows.length } });
  }),
);
