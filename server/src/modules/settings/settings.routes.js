import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { ApiError, asyncHandler } from '../../utils/ApiError.js';
import { requireAuth, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../utils/audit.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

/** Toutes les cles, renvoyees sous forme d'objet { cle: valeur }. */
settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query('SELECT key, value FROM settings ORDER BY key');
    res.json({ data: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }),
);

settingsRouter.get(
  '/:key',
  validate({ params: z.object({ key: z.string().min(1).max(64) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT key, value FROM settings WHERE key = $1', [req.params.key]);
    if (!rows[0]) throw ApiError.notFound('Paramètre introuvable');
    res.json({ data: rows[0].value });
  }),
);

/** Fusion superficielle : on ne remplace que les champs fournis. */
settingsRouter.put(
  '/:key',
  requireOwner,
  validate({
    params: z.object({ key: z.string().min(1).max(64) }),
    body: z.record(z.string(), z.any()),
  }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE
         SET value = settings.value || EXCLUDED.value, updated_at = now()
       RETURNING value`,
      [req.params.key, JSON.stringify(req.body)],
    );
    await audit({ userId: req.user.id, action: 'update', entity: 'settings', entityId: req.params.key });
    res.json({ data: rows[0].value });
  }),
);
