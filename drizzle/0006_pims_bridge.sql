-- ============================================================================
-- 0006_pims_bridge.sql
-- PIMS invoice bridge: key-value settings + import log (de-duplicated by
-- invoice number).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pims_settings (
  id            SERIAL PRIMARY KEY,
  setting_key   TEXT NOT NULL UNIQUE,
  setting_value JSON NOT NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pims_imports (
  id             SERIAL PRIMARY KEY,
  file_name      TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_name  TEXT,
  order_id       INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'imported',
  message        TEXT,
  raw_xml        TEXT,
  imported_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pims_imports_invoice ON pims_imports (invoice_number);

-- Starter service-code map: SER.01 = sawing -> Beam Saw. More codes can be
-- added from the PIMS Import screen.
INSERT INTO pims_settings (setting_key, setting_value)
SELECT 'service_map',
       '{"SER.01":{"operationName":"Beam Saw Cutting","machineCategory":"Beam Saw"}}'::json
WHERE NOT EXISTS (SELECT 1 FROM pims_settings WHERE setting_key = 'service_map');

COMMIT;
