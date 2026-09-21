import { Router } from 'express';
import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/ApiError.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

/** Indicateurs de la coque admin. Les modules des phases suivantes viendront s'y brancher. */
dashboardRouter.get(
  '/summary',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [stock, alerts, movements, waste, topValue] = await Promise.all([
      query(`SELECT count(*)::int AS "ingredientCount",
                    COALESCE(SUM(stock_value_millimes), 0)::bigint AS "stockValueMillimes"
               FROM v_ingredient_stock WHERE is_active`),
      query(`SELECT
               count(*) FILTER (WHERE stock_status = 'rupture')::int AS "outOfStock",
               count(*) FILTER (WHERE stock_status = 'bas')::int     AS "lowStock"
               FROM v_ingredient_stock WHERE is_active`),
      query(`SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
                    COALESCE(SUM(m.quantity * m.unit_cost_millimes) FILTER (WHERE m.type = 'entree'), 0)::bigint AS "inMillimes",
                    COALESCE(SUM(m.quantity * m.unit_cost_millimes) FILTER (WHERE m.type IN ('sortie','perte')), 0)::bigint AS "outMillimes"
               FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
               LEFT JOIN stock_movements m ON m.created_at::date = d.day
              GROUP BY d.day ORDER BY d.day`),
      query(`SELECT COALESCE(SUM(quantity * unit_cost_millimes), 0)::bigint AS "wasteMillimes"
               FROM stock_movements
              WHERE type = 'perte' AND created_at >= date_trunc('month', CURRENT_DATE)`),
      query(`SELECT name, unit, current_qty AS "currentQty", stock_value_millimes AS "stockValueMillimes"
               FROM v_ingredient_stock WHERE is_active AND stock_value_millimes > 0
              ORDER BY stock_value_millimes DESC LIMIT 5`),
    ]);

    res.json({
      data: {
        ...stock.rows[0],
        ...alerts.rows[0],
        wasteThisMonthMillimes: waste.rows[0].wasteMillimes,
        movementTrend: movements.rows,
        topValueIngredients: topValue.rows,
      },
    });
  }),
);

/** Vue du jour cote staff : ce qu'il faut surveiller pendant le service. */
dashboardRouter.get(
  '/staff-today',
  asyncHandler(async (_req, res) => {
    const [alerts, expiring, recent] = await Promise.all([
      query(`SELECT id, name, unit, current_qty AS "currentQty", min_threshold AS "minThreshold",
                    stock_status AS "stockStatus"
               FROM v_ingredient_stock
              WHERE is_active AND stock_status <> 'ok'
              ORDER BY CASE stock_status WHEN 'rupture' THEN 0 ELSE 1 END, name LIMIT 12`),
      query(`SELECT ingredient_name AS "ingredientName", unit, quantity_remaining AS "quantityRemaining",
                    expires_at AS "expiresAt", days_left AS "daysLeft", expiry_status AS "expiryStatus"
               FROM v_expiring_batches ORDER BY expires_at LIMIT 12`),
      query(`SELECT m.type, m.quantity, i.name AS "ingredientName", i.unit,
                    m.created_at AS "createdAt", u.full_name AS "createdByName"
               FROM stock_movements m
               JOIN ingredients i ON i.id = m.ingredient_id
               LEFT JOIN users u ON u.id = m.created_by
              WHERE m.created_at >= CURRENT_DATE
              ORDER BY m.created_at DESC LIMIT 10`),
    ]);

    res.json({ data: { alerts: alerts.rows, expiring: expiring.rows, recentMovements: recent.rows } });
  }),
);
