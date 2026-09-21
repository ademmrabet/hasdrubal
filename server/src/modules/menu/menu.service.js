import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

/** Colonnes de la vue de cout, en camelCase pour le front. */
export const COSTING_COLUMNS = `
  id, category_id AS "categoryId", category_name AS "categoryName", name, description,
  price_millimes AS "priceMillimes", vat_rate AS "vatRate",
  price_ht_millimes AS "priceHtMillimes", food_cost_millimes AS "foodCostMillimes",
  margin_millimes AS "marginMillimes", food_cost_pct AS "foodCostPct",
  recipe_line_count AS "recipeLineCount", portions_possible AS "portionsPossible",
  image_path AS "imagePath", allergens, tags, prep_time_min AS "prepTimeMin",
  is_active AS "isActive", is_available AS "isAvailable", is_featured AS "isFeatured",
  sort_order AS "sortOrder"`;

export async function listCategories({ includeInactive = true } = {}) {
  const { rows } = await query(
    `SELECT c.id, c.name, c.description, c.sort_order AS "sortOrder", c.is_active AS "isActive",
            count(m.id) FILTER (WHERE m.is_active)::int AS "itemCount"
       FROM menu_categories c
       LEFT JOIN menu_items m ON m.category_id = c.id
      WHERE ($1::boolean OR c.is_active)
      GROUP BY c.id
      ORDER BY c.sort_order, c.name`,
    [includeInactive],
  );
  return rows;
}

export async function listItems({ categoryId, search, includeInactive = false } = {}) {
  const { rows } = await query(
    `SELECT ${COSTING_COLUMNS} FROM v_menu_item_costing
      WHERE ($1::boolean OR is_active)
        AND ($2::uuid IS NULL OR category_id = $2)
        AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%')
      ORDER BY category_sort, sort_order, name`,
    [includeInactive, categoryId ?? null, search || null],
  );
  return rows;
}

export async function getItem(id) {
  const { rows } = await query(`SELECT ${COSTING_COLUMNS} FROM v_menu_item_costing WHERE id = $1`, [id]);
  if (!rows[0]) throw ApiError.notFound('Plat introuvable');

  const recipe = await query(
    `SELECT r.ingredient_id AS "ingredientId", i.name AS "ingredientName", i.unit,
            r.quantity, r.notes, s.avg_cost_millimes AS "avgCostMillimes",
            ROUND(r.quantity * s.avg_cost_millimes)::bigint AS "lineCostMillimes",
            s.current_qty AS "currentQty", s.stock_status AS "stockStatus"
       FROM recipes r
       JOIN ingredients i        ON i.id = r.ingredient_id
       JOIN v_ingredient_stock s ON s.id = r.ingredient_id
      WHERE r.menu_item_id = $1
      ORDER BY "lineCostMillimes" DESC, i.name`,
    [id],
  );
  return { ...rows[0], recipe: recipe.rows };
}

function itemParams(b) {
  return [
    b.categoryId, b.name, b.description ?? null, b.priceMillimes, b.vatRate,
    b.allergens ?? [], b.tags ?? [], b.prepTimeMin ?? null,
    b.isActive, b.isAvailable, b.isFeatured, b.sortOrder,
  ];
}

export async function createItem(body) {
  // Plat et fiche technique dans la meme transaction : pas de plat orphelin si la fiche est invalide.
  const id = await withTransaction(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO menu_items (category_id, name, description, price_millimes, vat_rate,
                               allergens, tags, prep_time_min, is_active, is_available, is_featured, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      itemParams(body),
    );
    if (body.recipe) await writeRecipe(db, rows[0].id, body.recipe);
    return rows[0].id;
  });
  return getItem(id);
}

export async function updateItem(id, body) {
  await withTransaction(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE menu_items SET category_id=$2, name=$3, description=$4, price_millimes=$5, vat_rate=$6,
              allergens=$7, tags=$8, prep_time_min=$9, is_active=$10, is_available=$11,
              is_featured=$12, sort_order=$13
        WHERE id = $1`,
      [id, ...itemParams(body)],
    );
    if (!rowCount) throw ApiError.notFound('Plat introuvable');
    if (body.recipe) await writeRecipe(db, id, body.recipe);
  });
  return getItem(id);
}

/** Remplace la fiche technique entiere : plus simple et plus sur qu'un diff ligne a ligne. */
async function writeRecipe(db, menuItemId, lines) {
  const seen = new Set();
  for (const line of lines) {
    if (seen.has(line.ingredientId)) {
      throw ApiError.badRequest('Un ingrédient apparaît deux fois dans la fiche technique');
    }
    seen.add(line.ingredientId);
  }

  const exists = await db.query('SELECT 1 FROM menu_items WHERE id = $1 FOR UPDATE', [menuItemId]);
  if (!exists.rowCount) throw ApiError.notFound('Plat introuvable');

  await db.query('DELETE FROM recipes WHERE menu_item_id = $1', [menuItemId]);
  for (const line of lines) {
    await db.query(
      'INSERT INTO recipes (menu_item_id, ingredient_id, quantity, notes) VALUES ($1,$2,$3,$4)',
      [menuItemId, line.ingredientId, line.quantity, line.notes ?? null],
    );
  }
}

export const replaceRecipe = (menuItemId, lines) =>
  withTransaction((db) => writeRecipe(db, menuItemId, lines));

export async function setAvailability(id, isAvailable) {
  const { rows } = await query(
    `UPDATE menu_items SET is_available = $2 WHERE id = $1
     RETURNING id, name, is_available AS "isAvailable"`,
    [id, isAvailable],
  );
  if (!rows[0]) throw ApiError.notFound('Plat introuvable');
  return rows[0];
}

export async function setImage(id, imagePath) {
  const { rows } = await query(
    `UPDATE menu_items m SET image_path = $2
       FROM (SELECT image_path AS old FROM menu_items WHERE id = $1) prev
      WHERE m.id = $1
      RETURNING prev.old AS "previousPath"`,
    [id, imagePath],
  );
  if (!rows[0]) throw ApiError.notFound('Plat introuvable');
  return rows[0].previousPath;
}

/** Menu public : pas de cout, pas de marge, uniquement ce que le client doit voir. */
export async function publicMenu({ showUnavailable = true } = {}) {
  const { rows } = await query(
    `SELECT c.id AS "categoryId", c.name AS "categoryName", c.description AS "categoryDescription",
            m.id, m.name, m.description, m.price_millimes AS "priceMillimes",
            m.image_path AS "imagePath", m.allergens, m.tags,
            m.is_available AS "isAvailable", m.is_featured AS "isFeatured"
       FROM menu_categories c
       JOIN menu_items m ON m.category_id = c.id
      WHERE c.is_active AND m.is_active AND ($1::boolean OR m.is_available)
      ORDER BY c.sort_order, c.name, m.sort_order, m.name`,
    [showUnavailable],
  );

  const categories = [];
  const byId = new Map();
  for (const row of rows) {
    let category = byId.get(row.categoryId);
    if (!category) {
      category = { id: row.categoryId, name: row.categoryName, description: row.categoryDescription, items: [] };
      byId.set(row.categoryId, category);
      categories.push(category);
    }
    const { categoryId, categoryName, categoryDescription, ...item } = row;
    category.items.push(item);
  }
  return categories;
}
