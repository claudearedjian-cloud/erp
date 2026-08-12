-- ============================================================================
-- 0002_stock_reservation.sql
-- Stock-reservation accounting for order materials
--
-- Before this migration, order_materials only tracked "what was allocated"
-- but stock was never actually reserved or consumed. This adds:
--   1. A `consumed` boolean on order_materials (default false)
--   2. A `consumed_at` timestamp for the audit trail
--   3. A `materials_status` enum-like column on orders
--   4. A `material_consumptions` table for the audit trail
--   5. Indexes for the common queries (per-order and per-item lookups)
-- ============================================================================

BEGIN;

-- 1. Add consumption columns to order_materials
ALTER TABLE order_materials
  ADD COLUMN IF NOT EXISTS consumed        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consumed_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS released        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_at      TIMESTAMP;

-- 2. Add materials_status to orders
-- 'unknown'     - no materials allocated yet
-- 'in_stock'    - all allocated materials have enough stock to fulfill
-- 'partial'     - some materials can be fulfilled, some cannot
-- 'out_of_stock' - all allocated materials exceed available stock
-- 'consumed'    - order is complete and all materials have been consumed
DO $$ BEGIN
  CREATE TYPE materials_status_enum AS ENUM (
    'unknown', 'in_stock', 'partial', 'out_of_stock', 'consumed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS materials_status TEXT
  DEFAULT 'unknown';

-- 3. Audit trail table - one row per consumption event
CREATE TABLE IF NOT EXISTS material_consumptions (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id         INTEGER NOT NULL REFERENCES inventory_items(id),
  quantity        INTEGER NOT NULL,
  consumed_by     INTEGER REFERENCES users(id),
  operation_id    INTEGER REFERENCES order_operations(id),
  notes           TEXT,
  consumed_at     TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. Indexes for the common queries
CREATE INDEX IF NOT EXISTS idx_order_materials_order_id
  ON order_materials(order_id);
CREATE INDEX IF NOT EXISTS idx_order_materials_item_id
  ON order_materials(item_id);
CREATE INDEX IF NOT EXISTS idx_order_materials_active
  ON order_materials(item_id, order_id) WHERE consumed = FALSE AND released = FALSE;

CREATE INDEX IF NOT EXISTS idx_material_consumptions_order
  ON material_consumptions(order_id, consumed_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_consumptions_item
  ON material_consumptions(item_id, consumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_materials_status
  ON orders(materials_status);

-- 5. Backfill: mark existing allocations as "unknown" status on their orders
UPDATE orders
SET materials_status = CASE
  WHEN (SELECT COUNT(*) FROM order_materials WHERE order_materials.order_id = orders.id) = 0
    THEN 'unknown'
  ELSE 'in_stock'  -- optimistic default for legacy data; can be recalculated
END
WHERE materials_status = 'unknown' OR materials_status IS NULL;

COMMIT;
