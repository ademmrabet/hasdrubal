import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { ApiError, asyncHandler } from '../../utils/ApiError.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { imageUpload, removeUpload } from '../../middleware/upload.js';
import { audit } from '../../utils/audit.js';
import * as service from './menu.service.js';

export const menuRouter = Router();
menuRouter.use(requireAuth);

export const VAT_RATES = [0, 7, 13, 19];
export const ALLERGENS = [
  'gluten', 'crustaces', 'oeufs', 'poisson', 'arachides', 'soja', 'lait',
  'fruits a coque', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques',
];

const idParam = z.object({ id: z.string().uuid('Identifiant invalide') });

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Nom requis'),
  description: z.string().trim().nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

const recipeLine = z.object({
  ingredientId: z.string().uuid('Ingrédient invalide'),
  quantity: z.coerce.number().positive('Quantité requise'),
  notes: z.string().trim().max(200).nullable().optional(),
});

const itemSchema = z.object({
  categoryId: z.string().uuid('Catégorie requise'),
  name: z.string().trim().min(2, 'Nom requis'),
  description: z.string().trim().max(500).nullable().optional(),
  priceMillimes: z.coerce.number().int().min(0, 'Prix invalide'),
  vatRate: z.coerce.number().refine((v) => VAT_RATES.includes(v), 'Taux de TVA : 0, 7, 13 ou 19 %'),
  allergens: z.array(z.enum(ALLERGENS)).default([]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  prepTimeMin: z.coerce.number().int().min(0).max(240).nullable().optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  recipe: z.array(recipeLine).optional(),
});

// --- Reference ---------------------------------------------------------
menuRouter.get('/reference', (_req, res) => res.json({ data: { vatRates: VAT_RATES, allergens: ALLERGENS } }));

// --- Categories ----------------------------------------------------------
menuRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => res.json({ data: await service.listCategories() })),
);

menuRouter.post(
  '/categories',
  requireAdmin,
  validate({ body: categorySchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO menu_categories (name, description, sort_order, is_active)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [b.name, b.description ?? null, b.sortOrder, b.isActive],
    );
    await audit({ userId: req.user.id, action: 'create', entity: 'menu_category', entityId: rows[0].id });
    res.status(201).json({ data: (await service.listCategories()).find((c) => c.id === rows[0].id) });
  }),
);

menuRouter.put(
  '/categories/:id',
  requireAdmin,
  validate({ params: idParam, body: categorySchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rowCount } = await query(
      `UPDATE menu_categories SET name=$2, description=$3, sort_order=$4, is_active=$5 WHERE id=$1`,
      [req.params.id, b.name, b.description ?? null, b.sortOrder, b.isActive],
    );
    if (!rowCount) throw ApiError.notFound('Catégorie introuvable');
    res.json({ data: (await service.listCategories()).find((c) => c.id === req.params.id) });
  }),
);

// Suppression reelle, refusee (409) tant que la categorie contient des plats.
menuRouter.delete(
  '/categories/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM menu_categories WHERE id = $1', [req.params.id]);
    if (!rowCount) throw ApiError.notFound('Catégorie introuvable');
    await audit({ userId: req.user.id, action: 'delete', entity: 'menu_category', entityId: req.params.id });
    res.status(204).end();
  }),
);

// --- Plats ---------------------------------------------------------------
menuRouter.get(
  '/items',
  validate({
    query: z.object({
      categoryId: z.string().uuid().optional(),
      search: z.string().trim().optional(),
      includeInactive: z.coerce.boolean().default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    const rows = await service.listItems(req.query);
    // Le staff ne voit pas les couts ni les marges.
    if (req.user.role === 'staff') {
      return res.json({
        data: rows.map(({ foodCostMillimes, marginMillimes, foodCostPct, priceHtMillimes, ...rest }) => rest),
      });
    }
    res.json({ data: rows });
  }),
);

menuRouter.get(
  '/items/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => res.json({ data: await service.getItem(req.params.id) })),
);

menuRouter.post(
  '/items',
  requireAdmin,
  validate({ body: itemSchema }),
  asyncHandler(async (req, res) => {
    const item = await service.createItem(req.body);
    await audit({ userId: req.user.id, action: 'create', entity: 'menu_item', entityId: item.id });
    res.status(201).json({ data: item });
  }),
);

menuRouter.put(
  '/items/:id',
  requireAdmin,
  validate({ params: idParam, body: itemSchema }),
  asyncHandler(async (req, res) => {
    const item = await service.updateItem(req.params.id, req.body);
    await audit({ userId: req.user.id, action: 'update', entity: 'menu_item', entityId: req.params.id });
    res.json({ data: item });
  }),
);

menuRouter.put(
  '/items/:id/recipe',
  requireAdmin,
  validate({ params: idParam, body: z.object({ lines: z.array(recipeLine) }) }),
  asyncHandler(async (req, res) => {
    await service.replaceRecipe(req.params.id, req.body.lines);
    await audit({ userId: req.user.id, action: 'update_recipe', entity: 'menu_item',
                  entityId: req.params.id, payload: { lines: req.body.lines.length } });
    res.json({ data: await service.getItem(req.params.id) });
  }),
);

// Rupture en service : le staff peut couper ou remettre un plat.
menuRouter.patch(
  '/items/:id/availability',
  validate({ params: idParam, body: z.object({ isAvailable: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const result = await service.setAvailability(req.params.id, req.body.isAvailable);
    await audit({ userId: req.user.id, action: req.body.isAvailable ? 'item_available' : 'item_unavailable',
                  entity: 'menu_item', entityId: req.params.id });
    res.json({ data: result });
  }),
);

menuRouter.post(
  '/items/:id/image',
  requireAdmin,
  validate({ params: idParam }),
  imageUpload('menu'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('Aucune image reçue (champ "image")');
    const publicPath = `/uploads/menu/${req.file.filename}`;
    try {
      const previous = await service.setImage(req.params.id, publicPath);
      await removeUpload(previous);
    } catch (err) {
      await removeUpload(publicPath);
      throw err;
    }
    res.json({ data: { imagePath: publicPath } });
  }),
);

menuRouter.delete(
  '/items/:id/image',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const previous = await service.setImage(req.params.id, null);
    await removeUpload(previous);
    res.status(204).end();
  }),
);

// Retrait de la carte (et non suppression) : l'historique des ventes y fera reference.
menuRouter.delete(
  '/items/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('UPDATE menu_items SET is_active = false WHERE id = $1', [req.params.id]);
    if (!rowCount) throw ApiError.notFound('Plat introuvable');
    await audit({ userId: req.user.id, action: 'deactivate', entity: 'menu_item', entityId: req.params.id });
    res.status(204).end();
  }),
);
