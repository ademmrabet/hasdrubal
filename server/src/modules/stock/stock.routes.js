import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/ApiError.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../utils/audit.js';
import * as service from './stock.service.js';

export const stockRouter = Router();
stockRouter.use(requireAuth);

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

const receiveSchema = z.object({
  ingredientId: z.string().uuid('Ingrédient requis'),
  supplierId: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().positive('Quantité requise'),
  unitCostMillimes: z.coerce.number().int().min(0).default(0),
  batchCode: z.string().trim().nullable().optional(),
  receivedAt: dateString.nullable().optional(),
  expiresAt: dateString.nullable().optional(),
  reference: z.string().trim().nullable().optional(),
});

const consumeSchema = z.object({
  ingredientId: z.string().uuid('Ingrédient requis'),
  quantity: z.coerce.number().positive('Quantité requise'),
  type: z.enum(['sortie', 'perte']).default('sortie'),
  reason: z.string().trim().max(300).nullable().optional(),
  reference: z.string().trim().nullable().optional(),
});

const inventorySchema = z.object({
  ingredientId: z.string().uuid('Ingrédient requis'),
  countedQty: z.coerce.number().min(0),
  reason: z.string().trim().max(300).nullable().optional(),
});

const movementsQuery = z.object({
  ingredientId: z.string().uuid().optional(),
  type: z.enum(['entree', 'sortie', 'perte', 'ajustement']).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// Le staff peut receptionner, sortir et declarer une perte : c'est le quotidien du service.
stockRouter.post(
  '/receive',
  validate({ body: receiveSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.receive({ ...req.body, userId: req.user.id });
    await audit({ userId: req.user.id, action: 'stock_receive', entity: 'ingredient',
                  entityId: req.body.ingredientId, payload: req.body });
    res.status(201).json({ data: result });
  }),
);

stockRouter.post(
  '/consume',
  validate({ body: consumeSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.consume({ ...req.body, userId: req.user.id });
    await audit({ userId: req.user.id, action: `stock_${req.body.type}`, entity: 'ingredient',
                  entityId: req.body.ingredientId, payload: req.body });
    res.json({ data: result });
  }),
);

// L'inventaire corrige le stock : reserve aux roles admin.
stockRouter.post(
  '/inventory',
  requireAdmin,
  validate({ body: inventorySchema }),
  asyncHandler(async (req, res) => {
    const result = await service.inventoryCount({ ...req.body, userId: req.user.id });
    await audit({ userId: req.user.id, action: 'stock_inventory', entity: 'ingredient',
                  entityId: req.body.ingredientId, payload: { ...req.body, ...result } });
    res.json({ data: result });
  }),
);

stockRouter.get(
  '/movements',
  validate({ query: movementsQuery }),
  asyncHandler(async (req, res) => {
    res.json(await service.listMovements(req.query));
  }),
);

stockRouter.get(
  '/alerts',
  asyncHandler(async (_req, res) => {
    res.json({ data: await service.alerts() });
  }),
);
