-- =====================================================================
-- 004 — Menu : categories, plats, fiches techniques, couts de revient
-- =====================================================================

CREATE TABLE menu_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX menu_categories_name_key ON menu_categories (lower(name));
CREATE TRIGGER menu_categories_set_updated_at BEFORE UPDATE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE menu_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  description     text,
  -- Prix affiche au client, TTC, en millimes. Le HT est deduit du taux de TVA.
  price_millimes  bigint NOT NULL CHECK (price_millimes >= 0),
  vat_rate        numeric(5,2) NOT NULL DEFAULT 19 CHECK (vat_rate IN (0, 7, 13, 19)),
  image_path      text,
  allergens       text[] NOT NULL DEFAULT '{}',
  tags            text[] NOT NULL DEFAULT '{}',   -- signature, vegetarien, epice...
  prep_time_min   integer CHECK (prep_time_min IS NULL OR prep_time_min >= 0),
  is_active       boolean NOT NULL DEFAULT true,  -- figure a la carte
  is_available    boolean NOT NULL DEFAULT true,  -- servable aujourd'hui (le staff peut le couper)
  is_featured     boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX menu_items_name_key ON menu_items (lower(name));
CREATE INDEX menu_items_category_idx ON menu_items (category_id, sort_order);
CREATE TRIGGER menu_items_set_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Fiche technique : quantite d'ingredient par portion, dans l'unite de l'ingredient.
CREATE TABLE recipes (
  menu_item_id  uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity      numeric(12,3) NOT NULL CHECK (quantity > 0),
  notes         text,
  PRIMARY KEY (menu_item_id, ingredient_id)
);
CREATE INDEX recipes_ingredient_idx ON recipes (ingredient_id);

-- ---------------------------------------------------------------------
-- Cout de revient par plat, a partir du cout moyen pondere des ingredients.
--   ratio matiere = cout matiere / prix HT
--   portions_possibles = combien de portions le stock actuel permet encore
-- ---------------------------------------------------------------------
CREATE VIEW v_menu_item_costing AS
SELECT
  m.id,
  m.category_id,
  c.name                        AS category_name,
  c.sort_order                  AS category_sort,
  m.name,
  m.description,
  m.price_millimes,
  m.vat_rate,
  ROUND(m.price_millimes / (1 + m.vat_rate / 100))::bigint AS price_ht_millimes,
  COALESCE(r.food_cost_millimes, 0)                        AS food_cost_millimes,
  ROUND(m.price_millimes / (1 + m.vat_rate / 100))::bigint
    - COALESCE(r.food_cost_millimes, 0)                    AS margin_millimes,
  CASE
    WHEN m.price_millimes = 0 THEN NULL
    ELSE ROUND(COALESCE(r.food_cost_millimes, 0) * 100.0
               / (m.price_millimes / (1 + m.vat_rate / 100)), 1)
  END                                                      AS food_cost_pct,
  COALESCE(r.line_count, 0)                                AS recipe_line_count,
  r.portions_possible,
  m.image_path,
  m.allergens,
  m.tags,
  m.prep_time_min,
  m.is_active,
  m.is_available,
  m.is_featured,
  m.sort_order
FROM menu_items m
JOIN menu_categories c ON c.id = m.category_id
LEFT JOIN LATERAL (
  SELECT
    ROUND(SUM(rc.quantity * s.avg_cost_millimes))::bigint AS food_cost_millimes,
    COUNT(*)::int                                         AS line_count,
    MIN(FLOOR(s.current_qty / rc.quantity))::int          AS portions_possible
  FROM recipes rc
  JOIN v_ingredient_stock s ON s.id = rc.ingredient_id
  WHERE rc.menu_item_id = m.id
) r ON true;

INSERT INTO settings (key, value) VALUES
  ('qr_menu', '{"baseUrl": null, "showUnavailable": true, "tableCardTitle": "Notre carte"}')
ON CONFLICT (key) DO NOTHING;
