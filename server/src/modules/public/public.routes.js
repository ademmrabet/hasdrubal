import { Router } from 'express';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/ApiError.js';
import { publicMenu } from '../menu/menu.service.js';

/**
 * Routes publiques, sans authentification : ce que voit un client qui
 * scanne le QR code sur sa table. Aucune donnee interne n'y figure.
 */
export const publicRouter = Router();

const PUBLIC_RESTAURANT_KEYS = [
  'name', 'suffix', 'fullName', 'phone', 'address', 'locatedIn', 'city',
  'priceRange', 'services', 'instagram', 'currency',
];

publicRouter.get(
  '/menu',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT key, value FROM settings WHERE key IN ('restaurant', 'opening_hours', 'qr_menu')`,
    );
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const restaurant = Object.fromEntries(
      Object.entries(settings.restaurant ?? {}).filter(([k]) => PUBLIC_RESTAURANT_KEYS.includes(k)),
    );

    const categories = await publicMenu({ showUnavailable: settings.qr_menu?.showUnavailable ?? true });

    // Le menu change peu : cache court cote navigateur et proxy.
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      data: {
        restaurant,
        openingHours: settings.opening_hours ?? null,
        categories,
        generatedAt: new Date().toISOString(),
      },
    });
  }),
);
