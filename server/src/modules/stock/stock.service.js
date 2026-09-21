import { withTransaction, query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

/** Arrondi a 3 decimales : les quantites sont stockees en numeric(12,3). */
const q3 = (n) => Math.round(n * 1000) / 1000;

async function lockIngredient(client, ingredientId) {
  const { rows } = await client.query(
    `SELECT id, name, unit, avg_cost_millimes, shelf_life_days, is_perishable
       FROM ingredients WHERE id = $1 FOR UPDATE`,
    [ingredientId],
  );
  if (!rows[0]) throw ApiError.notFound('Ingrédient introuvable');
  return rows[0];
}

async function currentQty(client, ingredientId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(quantity_remaining), 0) AS qty
       FROM stock_batches WHERE ingredient_id = $1 AND quantity_remaining > 0`,
    [ingredientId],
  );
  return Number(rows[0].qty);
}

/**
 * Reception de marchandise : cree un lot, trace un mouvement d'entree et
 * recalcule le cout moyen pondere de l'ingredient.
 */
export async function receive({
  ingredientId, supplierId, quantity, unitCostMillimes = 0,
  batchCode, expiresAt, receivedAt, reference, userId,
}) {
  if (quantity <= 0) throw ApiError.badRequest('La quantité doit être supérieure à zéro');

  return withTransaction(async (client) => {
    const ingredient = await lockIngredient(client, ingredientId);
    const qtyBefore = await currentQty(client, ingredientId);

    // Peremption deduite de la duree de conservation si elle n'est pas fournie.
    let expiry = expiresAt ?? null;
    if (!expiry && ingredient.is_perishable && ingredient.shelf_life_days) {
      const base = receivedAt ? new Date(receivedAt) : new Date();
      base.setDate(base.getDate() + ingredient.shelf_life_days);
      expiry = base.toISOString().slice(0, 10);
    }

    const { rows: batchRows } = await client.query(
      `INSERT INTO stock_batches
         (ingredient_id, supplier_id, batch_code, quantity_received, quantity_remaining,
          unit_cost_millimes, received_at, expires_at, created_by)
       VALUES ($1,$2,$3,$4,$4,$5, COALESCE($6, CURRENT_DATE), $7, $8)
       RETURNING id`,
      [ingredientId, supplierId ?? null, batchCode ?? null, q3(quantity),
       Math.round(unitCostMillimes), receivedAt ?? null, expiry, userId ?? null],
    );
    const batchId = batchRows[0].id;

    await client.query(
      `INSERT INTO stock_movements
         (ingredient_id, batch_id, type, quantity, unit_cost_millimes, reason, reference, created_by)
       VALUES ($1,$2,'entree',$3,$4,$5,$6,$7)`,
      [ingredientId, batchId, q3(quantity), Math.round(unitCostMillimes),
       'Réception fournisseur', reference ?? null, userId ?? null],
    );

    // Cout moyen pondere : (stock existant valorise + nouvelle reception) / quantite totale
    const totalQty = qtyBefore + quantity;
    const newAvg = totalQty > 0
      ? Math.round((qtyBefore * ingredient.avg_cost_millimes + quantity * unitCostMillimes) / totalQty)
      : Math.round(unitCostMillimes);
    await client.query('UPDATE ingredients SET avg_cost_millimes = $2 WHERE id = $1', [ingredientId, newAvg]);

    return { batchId, quantityAfter: q3(totalQty), avgCostMillimes: newAvg };
  });
}

/**
 * Sortie de stock (consommation ou perte), repartie sur les lots selon FEFO :
 * on vide d'abord le lot qui expire le plus tot, puis le plus ancien.
 */
export async function consume({ ingredientId, quantity, type = 'sortie', reason, reference, userId }) {
  if (quantity <= 0) throw ApiError.badRequest('La quantité doit être supérieure à zéro');
  if (!['sortie', 'perte'].includes(type)) throw ApiError.badRequest('Type de mouvement invalide');

  return withTransaction(async (client) => {
    const ingredient = await lockIngredient(client, ingredientId);

    const { rows: batches } = await client.query(
      `SELECT id, quantity_remaining, unit_cost_millimes
         FROM stock_batches
        WHERE ingredient_id = $1 AND quantity_remaining > 0
        ORDER BY expires_at NULLS LAST, received_at, id
        FOR UPDATE`,
      [ingredientId],
    );

    const available = batches.reduce((sum, b) => sum + Number(b.quantity_remaining), 0);
    if (available < quantity) {
      throw ApiError.badRequest(
        `Stock insuffisant pour ${ingredient.name} : ${q3(available)} ${ingredient.unit} disponible(s), ${q3(quantity)} demandé(s)`,
      );
    }

    let left = quantity;
    const consumed = [];
    for (const batch of batches) {
      if (left <= 0) break;
      const take = Math.min(left, Number(batch.quantity_remaining));
      await client.query(
        'UPDATE stock_batches SET quantity_remaining = quantity_remaining - $2 WHERE id = $1',
        [batch.id, q3(take)],
      );
      await client.query(
        `INSERT INTO stock_movements
           (ingredient_id, batch_id, type, quantity, unit_cost_millimes, reason, reference, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ingredientId, batch.id, type, q3(take), batch.unit_cost_millimes,
         reason ?? null, reference ?? null, userId ?? null],
      );
      consumed.push({ batchId: batch.id, quantity: q3(take), unitCostMillimes: batch.unit_cost_millimes });
      left = q3(left - take);
    }

    const costMillimes = consumed.reduce((sum, c) => sum + c.quantity * c.unitCostMillimes, 0);
    return { quantityAfter: q3(available - quantity), batchesTouched: consumed.length, costMillimes: Math.round(costMillimes) };
  });
}

/**
 * Inventaire physique : on saisit la quantite reellement comptee et le systeme
 * enregistre l'ecart comme un ajustement. C'est la seule facon de corriger un
 * stock sans casser la tracabilite.
 */
export async function inventoryCount({ ingredientId, countedQty, reason, userId }) {
  if (countedQty < 0) throw ApiError.badRequest('La quantité comptée ne peut pas être négative');

  return withTransaction(async (client) => {
    const ingredient = await lockIngredient(client, ingredientId);
    const before = await currentQty(client, ingredientId);
    const delta = q3(countedQty - before);

    if (delta === 0) return { delta: 0, quantityAfter: before, message: 'Aucun écart constaté' };

    if (delta > 0) {
      // Surplus : nouveau lot valorise au cout moyen courant.
      const { rows } = await client.query(
        `INSERT INTO stock_batches
           (ingredient_id, batch_code, quantity_received, quantity_remaining, unit_cost_millimes, created_by)
         VALUES ($1, 'INVENTAIRE', $2, $2, $3, $4) RETURNING id`,
        [ingredientId, delta, ingredient.avg_cost_millimes, userId ?? null],
      );
      await client.query(
        `INSERT INTO stock_movements
           (ingredient_id, batch_id, type, quantity, unit_cost_millimes, reason, reference, created_by)
         VALUES ($1,$2,'ajustement',$3,$4,$5,'inventaire',$6)`,
        [ingredientId, rows[0].id, delta, ingredient.avg_cost_millimes,
         reason ?? 'Écart positif d’inventaire', userId ?? null],
      );
    } else {
      // Manquant : on retire selon FEFO.
      let left = -delta;
      const { rows: batches } = await client.query(
        `SELECT id, quantity_remaining, unit_cost_millimes FROM stock_batches
          WHERE ingredient_id = $1 AND quantity_remaining > 0
          ORDER BY expires_at NULLS LAST, received_at, id FOR UPDATE`,
        [ingredientId],
      );
      for (const batch of batches) {
        if (left <= 0) break;
        const take = Math.min(left, Number(batch.quantity_remaining));
        await client.query(
          'UPDATE stock_batches SET quantity_remaining = quantity_remaining - $2 WHERE id = $1',
          [batch.id, q3(take)],
        );
        await client.query(
          `INSERT INTO stock_movements
             (ingredient_id, batch_id, type, quantity, unit_cost_millimes, reason, reference, created_by)
           VALUES ($1,$2,'ajustement',$3,$4,$5,'inventaire',$6)`,
          [ingredientId, batch.id, q3(take), batch.unit_cost_millimes,
           reason ?? 'Écart négatif d’inventaire', userId ?? null],
        );
        left = q3(left - take);
      }
    }

    return { delta, quantityAfter: q3(countedQty) };
  });
}

export async function listMovements({ ingredientId, type, from, to, limit = 100, offset = 0 }) {
  const { rows } = await query(
    `SELECT m.id, m.type, m.quantity, m.unit_cost_millimes AS "unitCostMillimes",
            (m.quantity * m.unit_cost_millimes)::bigint AS "valueMillimes",
            m.reason, m.reference, m.created_at AS "createdAt",
            i.id AS "ingredientId", i.name AS "ingredientName", i.unit,
            u.full_name AS "createdByName"
       FROM stock_movements m
       JOIN ingredients i ON i.id = m.ingredient_id
       LEFT JOIN users u  ON u.id = m.created_by
      WHERE ($1::uuid IS NULL OR m.ingredient_id = $1)
        AND ($2::text IS NULL OR m.type::text = $2)
        AND ($3::date IS NULL OR m.created_at >= $3)
        AND ($4::date IS NULL OR m.created_at < ($4::date + INTERVAL '1 day'))
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $5 OFFSET $6`,
    [ingredientId ?? null, type ?? null, from ?? null, to ?? null, limit, offset],
  );

  const { rows: countRows } = await query(
    `SELECT count(*)::int AS total FROM stock_movements m
      WHERE ($1::uuid IS NULL OR m.ingredient_id = $1)
        AND ($2::text IS NULL OR m.type::text = $2)
        AND ($3::date IS NULL OR m.created_at >= $3)
        AND ($4::date IS NULL OR m.created_at < ($4::date + INTERVAL '1 day'))`,
    [ingredientId ?? null, type ?? null, from ?? null, to ?? null],
  );

  return { data: rows, total: countRows[0].total, limit, offset };
}

export async function alerts() {
  const lowStock = await query(
    `SELECT id, name, unit, current_qty AS "currentQty", min_threshold AS "minThreshold",
            target_stock AS "targetStock", suggested_reorder_qty AS "suggestedReorderQty",
            stock_status AS "stockStatus", supplier_name AS "supplierName",
            avg_cost_millimes AS "avgCostMillimes"
       FROM v_ingredient_stock
      WHERE is_active AND stock_status <> 'ok'
      ORDER BY CASE stock_status WHEN 'rupture' THEN 0 ELSE 1 END, name`,
  );

  const expiring = await query(
    `SELECT id, ingredient_id AS "ingredientId", ingredient_name AS "ingredientName", unit,
            batch_code AS "batchCode", quantity_remaining AS "quantityRemaining",
            value_millimes AS "valueMillimes", expires_at AS "expiresAt",
            days_left AS "daysLeft", expiry_status AS "expiryStatus"
       FROM v_expiring_batches ORDER BY expires_at`,
  );

  return { lowStock: lowStock.rows, expiring: expiring.rows };
}
