-- ============================================================================
-- 0004_quality_downtime_wip.sql
-- Feature B: scrap & rework tracking, downtime logging, and the live WIP board.
--
--   quality_events  - one row per scrap / rework defect event.
--   downtime_events - one row per machine stoppage (ended_at NULL while open).
--
-- Idempotent: safe to run more than once.
-- Apply with:  psql "$DATABASE_URL" -f drizzle/0004_quality_downtime_wip.sql
-- ============================================================================

BEGIN;

-- 1. Scrap & rework event log
CREATE TABLE IF NOT EXISTS quality_events (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  operation_id   INTEGER REFERENCES order_operations(id) ON DELETE SET NULL,
  machine_id     INTEGER REFERENCES machines(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL,                       -- 'scrap' | 'rework'
  quantity       INTEGER NOT NULL DEFAULT 1,          -- pieces scrapped / sent for rework
  unit           TEXT NOT NULL DEFAULT 'pcs',
  reason         TEXT NOT NULL,                       -- reject reason
  disposition    TEXT NOT NULL DEFAULT 'Open',        -- Open | In Rework | Reworked & Passed | Scrapped
  estimated_cost NUMERIC NOT NULL DEFAULT '0.00',
  recorded_by_id INTEGER REFERENCES users(id),
  notes          TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_events_order    ON quality_events (order_id);
CREATE INDEX IF NOT EXISTS idx_quality_events_machine  ON quality_events (machine_id);
CREATE INDEX IF NOT EXISTS idx_quality_events_type     ON quality_events (event_type);
CREATE INDEX IF NOT EXISTS idx_quality_events_open     ON quality_events (disposition) WHERE disposition IN ('Open', 'In Rework');

-- 2. Machine downtime log
CREATE TABLE IF NOT EXISTS downtime_events (
  id               SERIAL PRIMARY KEY,
  machine_id       INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  order_id         INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  operation_id     INTEGER REFERENCES order_operations(id) ON DELETE SET NULL,
  reason           TEXT NOT NULL,                     -- Mechanical Failure | Electrical Fault | Material Shortage | Setup & Changeover | Operator Unavailable | Quality Issue | Other
  started_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMP,                         -- NULL while the stoppage is open
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  operator_id      INTEGER REFERENCES users(id),
  notes            TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_downtime_machine  ON downtime_events (machine_id);
CREATE INDEX IF NOT EXISTS idx_downtime_open     ON downtime_events (machine_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_downtime_started  ON downtime_events (started_at);

COMMIT;
