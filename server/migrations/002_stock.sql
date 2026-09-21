-- =====================================================================
-- 002 — Stock : fournisseurs, ingredients, lots, mouvements, commandes
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE unit_type AS ENUM ('kg', 'g', 'l', 'ml', 'piece', 'botte', 'boite', 'bouteille');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE movement_type AS ENUM ('entree', 'sortie', 'perte', 'ajustement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('brouillon', 'envoyee', 'partielle', 'recue', 'annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE suppliers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  contact_name        text,
  phone               text,
  email               text,
  address             text,
  tax_id              text,               -- matricule fiscal
  payment_terms_days  integer NOT NULL DEFAULT 0,
  notes               text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX suppliers_name_key ON suppliers (lower(name));
CREATE TRIGGER suppliers_set_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ingredient_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ingredient_categories_name_key ON ingredient_categories (lower(name));

CREATE TABLE ingredients (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  category_id          uuid REFERENCES ingredient_categories(id) ON DELETE SET NULL,
  unit                 unit_type NOT NULL,
  min_threshold        numeric(12,3) NOT NULL DEFAULT 0,   -- seuil d'alerte
  target_stock         numeric(12,3) NOT NULL DEFAULT 0,   -- niveau a reconstituer
  is_perishable        boolean NOT NULL DEFAULT false,
  shelf_life_days      integer,
  default_supplier_id  uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  avg_cost_millimes    bigint NOT NULL DEFAULT 0,          -- cout moyen pondere par unite
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredients_shelf_life_ck
    CHECK (NOT is_perishable OR shelf_life_days IS NOT NULL)
);
CREATE UNIQUE INDEX ingredients_name_key ON ingredients (lower(name));
CREATE INDEX ingredients_category_idx ON ingredients (category_id);
CREATE TRIGGER ingredients_set_updated_at BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Un lot = une reception. Le stock courant est la somme des quantity_remaining.
CREATE TABLE stock_batches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id      uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  supplier_id        uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  batch_code         text,
  quantity_received  numeric(12,3) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining numeric(12,3) NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost_millimes bigint NOT NULL DEFAULT 0 CHECK (unit_cost_millimes >= 0),
  received_at        date NOT NULL DEFAULT CURRENT_DATE,
  expires_at         date,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_batches_remaining_ck CHECK (quantity_remaining <= quantity_received)
);
CREATE INDEX stock_batches_ingredient_idx ON stock_batches (ingredient_id);
-- FIFO / FEFO : on consomme d'abord ce qui expire le plus tot
CREATE INDEX stock_batches_open_idx ON stock_batches (ingredient_id, expires_at NULLS LAST, received_at)
  WHERE quantity_remaining > 0;

-- Journal immuable de toutes les operations de stock
CREATE TABLE stock_movements (
  id                 bigserial PRIMARY KEY,
  ingredient_id      uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  batch_id           uuid REFERENCES stock_batches(id) ON DELETE SET NULL,
  type               movement_type NOT NULL,
  quantity           numeric(12,3) NOT NULL CHECK (quantity > 0),  -- toujours positive
  unit_cost_millimes bigint NOT NULL DEFAULT 0,
  reason             text,
  reference          text,                                          -- bon de commande, ticket, inventaire
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_ingredient_idx ON stock_movements (ingredient_id, created_at DESC);
CREATE INDEX stock_movements_created_idx ON stock_movements (created_at DESC);
CREATE INDEX stock_movements_type_idx ON stock_movements (type, created_at DESC);

CREATE TABLE purchase_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text NOT NULL UNIQUE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status         po_status NOT NULL DEFAULT 'brouillon',
  expected_at    date,
  total_millimes bigint NOT NULL DEFAULT 0,
  notes          text,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_orders_supplier_idx ON purchase_orders (supplier_id, created_at DESC);
CREATE TRIGGER purchase_orders_set_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE purchase_order_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id      uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity           numeric(12,3) NOT NULL CHECK (quantity > 0),
  received_quantity  numeric(12,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_cost_millimes bigint NOT NULL DEFAULT 0
);
CREATE INDEX purchase_order_items_po_idx ON purchase_order_items (purchase_order_id);

-- ---------------------------------------------------------------------
-- Vues de lecture
-- ---------------------------------------------------------------------

-- Etat du stock par ingredient : quantite, valeur, statut d'alerte
CREATE VIEW v_ingredient_stock AS
SELECT
  i.id,
  i.name,
  i.unit,
  i.min_threshold,
  i.target_stock,
  i.is_active,
  i.is_perishable,
  i.avg_cost_millimes,
  i.category_id,
  c.name AS category_name,
  i.default_supplier_id,
  s.name AS supplier_name,
  COALESCE(b.current_qty, 0)                          AS current_qty,
  COALESCE(b.stock_value_millimes, 0)                 AS stock_value_millimes,
  GREATEST(i.target_stock - COALESCE(b.current_qty, 0), 0) AS suggested_reorder_qty,
  CASE
    WHEN COALESCE(b.current_qty, 0) <= 0                THEN 'rupture'
    WHEN COALESCE(b.current_qty, 0) <= i.min_threshold  THEN 'bas'
    ELSE 'ok'
  END AS stock_status,
  b.next_expiry
FROM ingredients i
LEFT JOIN ingredient_categories c ON c.id = i.category_id
LEFT JOIN suppliers s             ON s.id = i.default_supplier_id
LEFT JOIN LATERAL (
  SELECT
    SUM(sb.quantity_remaining)                                  AS current_qty,
    SUM(sb.quantity_remaining * sb.unit_cost_millimes)::bigint  AS stock_value_millimes,
    MIN(sb.expires_at) FILTER (WHERE sb.expires_at IS NOT NULL) AS next_expiry
  FROM stock_batches sb
  WHERE sb.ingredient_id = i.id AND sb.quantity_remaining > 0
) b ON true;

-- Lots perissables proches de la peremption ou deja perimes
CREATE VIEW v_expiring_batches AS
SELECT
  sb.id,
  sb.ingredient_id,
  i.name AS ingredient_name,
  i.unit,
  sb.batch_code,
  sb.quantity_remaining,
  sb.unit_cost_millimes,
  (sb.quantity_remaining * sb.unit_cost_millimes)::bigint AS value_millimes,
  sb.expires_at,
  (sb.expires_at - CURRENT_DATE) AS days_left,
  CASE WHEN sb.expires_at < CURRENT_DATE THEN 'perime' ELSE 'bientot' END AS expiry_status
FROM stock_batches sb
JOIN ingredients i ON i.id = sb.ingredient_id
WHERE sb.quantity_remaining > 0
  AND sb.expires_at IS NOT NULL
  AND sb.expires_at <= CURRENT_DATE + INTERVAL '7 days';
