/**
 * Import d'une carte (categories + plats) dans la base. Partage par le seed
 * de demonstration et par le script d'import non destructif.
 *
 * Regles :
 *  - un plat ou une categorie est identifie par son nom (casse ignoree) ;
 *  - par defaut, ce qui existe deja n'est JAMAIS modifie (prix, photos, fiches
 *    et disponibilite saisis dans l'application sont preserves) ;
 *  - avec `sync: true`, categorie, prix, description, allergenes et ordre des
 *    plats existants sont realignes sur la carte fournie ; fiches, photos,
 *    TVA et disponibilite restent intacts ;
 *  - un plat sans prix est cree inactif (prix 0) : il n'apparait pas au public.
 */

const toMillimes = (dinars) => Math.round(dinars * 1000);

/**
 * @param db        client pg (dans une transaction)
 * @param carte     tableau de categories { category, description, order, items[] }
 * @param opts.vat  taux de TVA des nouveaux plats (defaut : parametre du restaurant)
 * @param opts.sync realigner les plats existants
 * @param opts.ingredientIds  { nom: id } pour creer les fiches techniques
 * @param opts.fiches { nomDuPlat: [[nomIngredient, quantite], ...] } fiches a creer
 */
export async function importCarte(db, carte, { vat, sync = false, ingredientIds = null, fiches = null } = {}) {
  let defaultVat = vat;
  if (defaultVat == null) {
    const { rows } = await db.query("SELECT value FROM settings WHERE key = 'vat'");
    defaultVat = rows[0]?.value?.default ?? 19;
  }

  const stats = {
    categoriesCreated: 0, itemsCreated: 0, itemsUpdated: 0, itemsKept: 0,
    withoutPrice: [], recipeLines: 0,
  };

  for (const category of carte) {
    const found = await db.query('SELECT id FROM menu_categories WHERE lower(name) = lower($1)', [category.category]);
    let categoryId = found.rows[0]?.id;
    if (!categoryId) {
      const { rows } = await db.query(
        'INSERT INTO menu_categories (name, description, sort_order) VALUES ($1,$2,$3) RETURNING id',
        [category.category, category.description ?? null, category.order],
      );
      categoryId = rows[0].id;
      stats.categoriesCreated++;
    }

    for (const [index, item] of category.items.entries()) {
      const hasPrice = typeof item.price === 'number';
      const price = hasPrice ? toMillimes(item.price) : 0;
      const tags = item.tags ?? [];
      const allergens = item.allergens ?? [];

      const existing = await db.query('SELECT id FROM menu_items WHERE lower(name) = lower($1)', [item.name]);
      if (existing.rowCount) {
        if (!sync) { stats.itemsKept++; continue; }
        await db.query(
          `UPDATE menu_items SET category_id=$2, description=$3, price_millimes=COALESCE($4, price_millimes),
                                 allergens=$5, sort_order=$6
            WHERE id = $1`,
          [existing.rows[0].id, categoryId, item.description ?? null,
           hasPrice ? price : null, allergens, index],
        );
        stats.itemsUpdated++;
        continue;
      }

      const { rows: dish } = await db.query(
        `INSERT INTO menu_items (category_id, name, description, price_millimes, vat_rate,
                                 allergens, tags, is_active, is_featured, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [categoryId, item.name, item.description ?? null, price, item.vat ?? defaultVat,
         allergens, tags, hasPrice, tags.includes('signature'), index],
      );
      stats.itemsCreated++;
      if (!hasPrice) stats.withoutPrice.push(item.name);

      const lines = item.recipe ?? fiches?.[item.name];
      if (lines?.length && ingredientIds) {
        for (const [ingredient, quantity] of lines) {
          if (!ingredientIds[ingredient]) throw new Error(`Ingrédient inconnu dans la fiche de « ${item.name} » : ${ingredient}`);
          await db.query('INSERT INTO recipes (menu_item_id, ingredient_id, quantity) VALUES ($1,$2,$3)',
            [dish[0].id, ingredientIds[ingredient], quantity]);
          stats.recipeLines++;
        }
      }
    }
  }
  return stats;
}
