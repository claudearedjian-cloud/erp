-- ============================================================================
-- 0003_workforce_shift_attendance.sql
-- Workforce module: shift definitions, shift assignments (production
-- calendar) and time & attendance clock records.
-- Idempotent: safe to run more than once.
-- ============================================================================

BEGIN;

-- 1. Shift definitions (Morning / Afternoon / Night, or factory custom)
CREATE TABLE IF NOT EXISTS shifts (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  start_time  TEXT NOT NULL DEFAULT '06:00',   -- "HH:MM" 24h
  end_time    TEXT NOT NULL DEFAULT '14:00',   -- "HH:MM" 24h
  color       TEXT NOT NULL DEFAULT 'bg-amber-500',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Shift assignments: who works which shift on which day (and station)
CREATE TABLE IF NOT EXISTS shift_assignments (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id    INTEGER NOT NULL REFERENCES shifts(id),
  work_date   DATE NOT NULL,                    -- 'YYYY-MM-DD'
  machine_id  INTEGER REFERENCES machines(id),
  notes       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Time & attendance: one row per clock-in; clock_out NULL while on shift
CREATE TABLE IF NOT EXISTS attendance (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_id    INTEGER REFERENCES shifts(id),
  clock_in    TIMESTAMP NOT NULL DEFAULT NOW(),
  clock_out   TIMESTAMP,
  status      TEXT NOT NULL DEFAULT 'Present',  -- Present, Late, Absent
  notes       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Seed default shifts (skip if shifts already exist)
INSERT INTO shifts (name, start_time, end_time, color)
SELECT v.name, v.start_time, v.end_time, v.color
FROM (VALUES
  ('Morning',   '06:00', '14:00', 'bg-amber-500'),
  ('Afternoon', '14:00', '22:00', 'bg-blue-500'),
  ('Night',     '22:00', '06:00', 'bg-purple-500')
) AS v(name, start_time, end_time, color)
WHERE NOT EXISTS (SELECT 1 FROM shifts);

-- 5. Indexes for the common queries
CREATE INDEX IF NOT EXISTS idx_shift_assignments_date
  ON shift_assignments(work_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_assignments_user_date
  ON shift_assignments(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_clockin
  ON attendance(user_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_attendance_clockin
  ON attendance(clock_in);

COMMIT;
