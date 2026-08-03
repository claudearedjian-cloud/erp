-- ============================================================================
-- 0001_data_isolation.sql
-- Adds data-isolation columns to customers and orders, and assigns existing
-- rows to the seeded Sales Coordinator (Chloe Shen) so the demo data stays
-- visible after the new scoping rules take effect.
-- ============================================================================

-- 1. Add the new columns (nullable to keep this migration safe on existing data)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS assigned_sales_id INTEGER REFERENCES users(id);
ALTER TABLE orders    ADD COLUMN IF NOT EXISTS created_by_id     INTEGER REFERENCES users(id);
ALTER TABLE orders    ADD COLUMN IF NOT EXISTS assigned_sales_id INTEGER REFERENCES users(id);

-- 2. Backfill: assign the seeded Sales Coordinator (Chloe Shen) to all existing
--    customers and orders. The seed inserts her with role "Sales Coordinator";
--    using a subquery keeps this script idempotent even if her id changes.
UPDATE customers
SET    assigned_sales_id = (SELECT id FROM users WHERE role = 'Sales Coordinator' ORDER BY id LIMIT 1)
WHERE  assigned_sales_id IS NULL;

UPDATE orders
SET    created_by_id     = (SELECT id FROM users WHERE role = 'Sales Coordinator' ORDER BY id LIMIT 1),
       assigned_sales_id = (SELECT id FROM users WHERE role = 'Sales Coordinator' ORDER BY id LIMIT 1)
WHERE  created_by_id IS NULL
   OR  assigned_sales_id IS NULL;

-- 3. Helpful indexes (these match the WHERE clauses in src/lib/dataAccess.ts)
CREATE INDEX IF NOT EXISTS idx_customers_assigned_sales_id ON customers(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by_id       ON orders(created_by_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_sales_id   ON orders(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id         ON orders(customer_id);
