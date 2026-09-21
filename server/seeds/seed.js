/**
 * Donnees de demonstration : comptes, fournisseurs, ingredients, lots et
 * historique de mouvements sur 14 jours pour alimenter les tableaux de bord.
 * La carte est la VRAIE carte de Hasdrubal (data/carte-hasdrubal.js), avec
 * quelques fiches techniques indicatives. SEED_MENU=demo charge a la place la
 * carte inventee utilisee par les tests automatiques.
 *
 * Relancer le script EFFACE toutes les donnees. Pour ajouter la carte sans
 * rien effacer : npm run import:menu.
 */
import { pool, withTransaction } from '../src/config/db.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { importCarte } from './lib/carte.js';
import { CARTE_HASDRUBAL } from './data/carte-hasdrubal.js';
import { CARTE_DEMO } from './data/carte-demo.js';
import { FICHES_DEMO } from './data/fiches-demo.js';

const DEMO_PASSWORD = 'Hasdrubal2026!';

const USERS = [
  { fullName: 'Propriétaire Hasdrubal', email: 'owner@hasdrubal.tn',   role: 'owner',   phone: '+216 20 000 001' },
  { fullName: 'Responsable de salle',   email: 'manager@hasdrubal.tn', role: 'manager', phone: '+216 20 000 002' },
  { fullName: 'Équipe cuisine',         email: 'staff@hasdrubal.tn',   role: 'staff',   phone: '+216 20 000 003' },
];

const SUPPLIERS = [
  { name: 'Boucherie El Amen',     contact: 'Slim Ben Ali',   phone: '+216 71 300 100', terms: 15 },
  { name: 'Marché de gros Bir El Kassaa', contact: 'Hedi Trabelsi', phone: '+216 71 400 200', terms: 0 },
  { name: 'Marée du Golfe',        contact: 'Nizar Gharbi',   phone: '+216 72 500 300', terms: 7 },
  { name: 'Épicerie Zitouna',      contact: 'Mouna Jelassi',  phone: '+216 71 600 400', terms: 30 },
];

const CATEGORIES = [
  { name: 'Viandes',            order: 1 },
  { name: 'Poissons et fruits de mer', order: 2 },
  { name: 'Légumes et fruits',  order: 3 },
  { name: 'Épicerie sèche',     order: 4 },
  { name: 'Produits laitiers',  order: 5 },
  { name: 'Boissons',           order: 6 },
];

// [nom, categorie, unite, seuil, cible, perissable, duree(j), fournisseur, cout unitaire en millimes]
const INGREDIENTS = [
  ['Agneau épaule',      'Viandes', 'kg', 8, 30, true, 5, 'Boucherie El Amen', 38000],
  ['Bœuf haché',        'Viandes', 'kg', 6, 25, true, 3, 'Boucherie El Amen', 29000],
  ['Poulet fermier',     'Viandes', 'kg', 10, 40, true, 4, 'Boucherie El Amen', 12500],
  ['Merguez',            'Viandes', 'kg', 4, 15, true, 4, 'Boucherie El Amen', 22000],
  ['Loup de mer',        'Poissons et fruits de mer', 'kg', 5, 20, true, 2, 'Marée du Golfe', 42000],
  ['Crevettes royales',  'Poissons et fruits de mer', 'kg', 3, 12, true, 2, 'Marée du Golfe', 55000],
  ['Calamars',           'Poissons et fruits de mer', 'kg', 3, 10, true, 2, 'Marée du Golfe', 26000],
  ['Tomates',            'Légumes et fruits', 'kg', 15, 50, true, 6, 'Marché de gros Bir El Kassaa', 2200],
  ['Oignons',            'Légumes et fruits', 'kg', 20, 60, true, 30, 'Marché de gros Bir El Kassaa', 1800],
  ['Pommes de terre',    'Légumes et fruits', 'kg', 25, 80, true, 30, 'Marché de gros Bir El Kassaa', 1500],
  ['Poivrons verts',     'Légumes et fruits', 'kg', 8, 25, true, 7, 'Marché de gros Bir El Kassaa', 2600],
  ['Citrons',            'Légumes et fruits', 'kg', 5, 20, true, 14, 'Marché de gros Bir El Kassaa', 3200],
  ['Persil',             'Légumes et fruits', 'botte', 10, 40, true, 3, 'Marché de gros Bir El Kassaa', 500],
  ['Semoule fine',       'Épicerie sèche', 'kg', 20, 80, false, null, 'Épicerie Zitouna', 2400],
  ['Huile d’olive',      'Épicerie sèche', 'l', 10, 40, false, null, 'Épicerie Zitouna', 14000],
  ['Harissa',            'Épicerie sèche', 'kg', 4, 15, false, null, 'Épicerie Zitouna', 8500],
  ['Sel de mer',         'Épicerie sèche', 'kg', 5, 20, false, null, 'Épicerie Zitouna', 900],
  ['Farine',             'Épicerie sèche', 'kg', 15, 60, false, null, 'Épicerie Zitouna', 1900],
  ['Beurre',             'Produits laitiers', 'kg', 4, 15, true, 20, 'Épicerie Zitouna', 16000],
  ['Fromage râpé',       'Produits laitiers', 'kg', 3, 12, true, 15, 'Épicerie Zitouna', 21000],
  ['Œufs',              'Produits laitiers', 'piece', 60, 300, true, 21, 'Épicerie Zitouna', 350],
  ['Eau minérale 1,5L',  'Boissons', 'bouteille', 48, 200, false, null, 'Épicerie Zitouna', 750],
  ['Boisson gazeuse 1L', 'Boissons', 'bouteille', 36, 150, false, null, 'Épicerie Zitouna', 1600],
  ['Spaghetti',          'Épicerie sèche', 'kg', 5, 20, false, null, 'Épicerie Zitouna', 4200],
  ['Pistaches',          'Épicerie sèche', 'kg', 1, 5, false, null, 'Épicerie Zitouna', 58000],
  ['Sucre',              'Épicerie sèche', 'kg', 5, 25, false, null, 'Épicerie Zitouna', 1500],
  ['Thé vert',           'Épicerie sèche', 'kg', 1, 4, false, null, 'Épicerie Zitouna', 32000],
  ['Crème fraîche',      'Produits laitiers', 'l', 2, 10, true, 10, 'Épicerie Zitouna', 11000],
  ['Menthe fraîche',     'Légumes et fruits', 'botte', 5, 20, true, 4, 'Marché de gros Bir El Kassaa', 600],
];

const rand = (min, max) => Math.round((min + Math.random() * (max - min)) * 1000) / 1000;

async function main() {
  console.log('Remise à zéro des données de démonstration...');

  await withTransaction(async (db) => {
    await db.query(`TRUNCATE recipes, menu_items, menu_categories,
                             stock_movements, stock_batches, purchase_order_items, purchase_orders,
                             ingredients, ingredient_categories, suppliers, audit_log,
                             refresh_tokens, users RESTART IDENTITY CASCADE`);

    // --- Comptes -----------------------------------------------------
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const userIds = {};
    for (const u of USERS) {
      const { rows } = await db.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [u.fullName, u.email, u.phone, passwordHash, u.role],
      );
      userIds[u.role] = rows[0].id;
    }

    // --- Fournisseurs ------------------------------------------------
    const supplierIds = {};
    for (const s of SUPPLIERS) {
      const { rows } = await db.query(
        `INSERT INTO suppliers (name, contact_name, phone, payment_terms_days)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [s.name, s.contact, s.phone, s.terms],
      );
      supplierIds[s.name] = rows[0].id;
    }

    // --- Categories --------------------------------------------------
    const categoryIds = {};
    for (const c of CATEGORIES) {
      const { rows } = await db.query(
        'INSERT INTO ingredient_categories (name, sort_order) VALUES ($1,$2) RETURNING id',
        [c.name, c.order],
      );
      categoryIds[c.name] = rows[0].id;
    }

    // --- Ingredients, lots et mouvements ------------------------------
    let movementCount = 0;
    const ingredientIds = {};
    for (const [name, category, unit, min, target, perishable, shelfLife, supplier, cost] of INGREDIENTS) {
      const { rows } = await db.query(
        `INSERT INTO ingredients (name, category_id, unit, min_threshold, target_stock,
                                  is_perishable, shelf_life_days, default_supplier_id, avg_cost_millimes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [name, categoryIds[category], unit, min, target, perishable, shelfLife, supplierIds[supplier], cost],
      );
      const ingredientId = rows[0].id;
      ingredientIds[name] = ingredientId;

      // Reception initiale il y a 12 jours, puis un reassort il y a 3 jours.
      for (const daysAgo of [12, 3]) {
        const quantity = rand(target * 0.5, target * 0.9);
        const unitCost = Math.round(cost * rand(0.95, 1.06));
        const { rows: batch } = await db.query(
          `INSERT INTO stock_batches
             (ingredient_id, supplier_id, batch_code, quantity_received, quantity_remaining,
              unit_cost_millimes, received_at, expires_at, created_by)
           VALUES ($1,$2,$3,$4,$4,$5,
                   CURRENT_DATE - $6::int,
                   CASE WHEN $7::int IS NULL THEN NULL ELSE CURRENT_DATE - $6::int + $7::int END,
                   $8)
           RETURNING id`,
          [ingredientId, supplierIds[supplier], `L${daysAgo}-${Math.floor(Math.random() * 900 + 100)}`,
           quantity, unitCost, daysAgo, shelfLife, userIds.manager],
        );

        await db.query(
          `INSERT INTO stock_movements
             (ingredient_id, batch_id, type, quantity, unit_cost_millimes, reason, created_by, created_at)
           VALUES ($1,$2,'entree',$3,$4,'Reception fournisseur',$5, now() - ($6::int || ' days')::interval)`,
          [ingredientId, batch[0].id, quantity, unitCost, userIds.manager, daysAgo],
        );
        movementCount++;
      }

      // Consommation quotidienne sur les 11 derniers jours, plus quelques pertes.
      for (let daysAgo = 11; daysAgo >= 0; daysAgo--) {
        const used = rand(target * 0.03, target * 0.09);
        const { rows: open } = await db.query(
          `SELECT id, quantity_remaining, unit_cost_millimes FROM stock_batches
            WHERE ingredient_id = $1 AND quantity_remaining > 0
            ORDER BY expires_at NULLS LAST, received_at, id`,
          [ingredientId],
        );
        let left = used;
        for (const b of open) {
          if (left <= 0) break;
          const take = Math.min(left, Number(b.quantity_remaining));
          await db.query('UPDATE stock_batches SET quantity_remaining = quantity_remaining - $2 WHERE id = $1',
            [b.id, take]);
          const isWaste = Math.random() < 0.07;
          await db.query(
            `INSERT INTO stock_movements
               (ingredient_id, batch_id, type, quantity, unit_cost_millimes, reason, created_by, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7, now() - ($8::int || ' days')::interval)`,
            [ingredientId, b.id, isWaste ? 'perte' : 'sortie', Math.round(take * 1000) / 1000,
             b.unit_cost_millimes, isWaste ? 'Produit abîmé' : 'Consommation service',
             userIds.staff, daysAgo],
          );
          movementCount++;
          left = Math.round((left - take) * 1000) / 1000;
        }
      }
    }

    // --- Carte et fiches techniques -----------------------------------
    const demoMenu = process.env.SEED_MENU === 'demo';
    const carte = await importCarte(db, demoMenu ? CARTE_DEMO : CARTE_HASDRUBAL, {
      ingredientIds,
      fiches: demoMenu ? null : FICHES_DEMO,
    });
    const dishCount = carte.itemsCreated;
    const categoryCount = carte.categoriesCreated;

    console.log(`  ${USERS.length} comptes, ${SUPPLIERS.length} fournisseurs, ${INGREDIENTS.length} ingrédients`);
    console.log(`  carte ${demoMenu ? 'de démonstration' : 'Hasdrubal'} : ${categoryCount} catégories, ${dishCount} plats, ${carte.recipeLines} lignes de fiche technique`);
    if (carte.withoutPrice.length) console.log(`  sans prix (inactifs) : ${carte.withoutPrice.join(', ')}`);
    console.log(`  ${movementCount} mouvements de stock sur 14 jours`);
  });

  console.log(`\nComptes de démonstration (mot de passe : ${DEMO_PASSWORD})`);
  for (const u of USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

main()
  .catch((err) => {
    console.error('Échec du seed :', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
