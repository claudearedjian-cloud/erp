-- ============================================================================
-- 0005_order_routing.sql
-- Order routing upgrade: real machine vocabulary + routing recipes.
--
--   * renames the saw to "Beam Saw" (category Beam Saw) and CNCs to Rover A/G
--   * adds Baz CNC and the Orma 36mm Press (new "Press" category)
--   * installs the shop's six routing recipes as operation templates
--
-- Idempotent: safe to run more than once.
-- Apply with:  psql "$DATABASE_URL" -f drizzle/0005_order_routing.sql
-- ============================================================================

BEGIN;

-- 1. Align machine vocabulary -------------------------------------------------
UPDATE machines SET category = 'Beam Saw' WHERE category = 'Panel Saw';
UPDATE machines SET name = 'Beam Saw', code = 'BEAM-01' WHERE code = 'SAW-01';
UPDATE machines SET name = 'Rover A CNC', code = 'ROVER-A' WHERE code = 'CNC-01';
UPDATE machines SET name = 'Rover G CNC', code = 'ROVER-G' WHERE code = 'CNC-02';

-- 2. Add missing machines -----------------------------------------------------
INSERT INTO machines (name, code, category, status, hourly_cost, location, notes)
SELECT 'Baz CNC', 'BAZ', 'CNC Router', 'Active', '90.00', 'Bay A - Milling Cell', 'Heavy-duty 5-axis CNC for thick panels and press material.'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE code = 'BAZ');

INSERT INTO machines (name, code, category, status, hourly_cost, location, notes)
SELECT 'Orma Press 36mm', 'ORMA-01', 'Press', 'Active', '70.00', 'Bay G - Press Area', '36mm panel laminating & pressing line. Oversize trim required after press.'
WHERE NOT EXISTS (SELECT 1 FROM machines WHERE code = 'ORMA-01');

-- 3. Routing recipes ----------------------------------------------------------
INSERT INTO operation_templates (name, description, default_steps_json)
SELECT 'Cutting Only',
       'Beam saw cutting only — panels cut to size and dispatched.',
       '[{"stepOrder":1,"operationName":"Beam Saw Cutting","machineCategory":"Beam Saw","estimatedMinutes":90}]'::json
WHERE NOT EXISTS (SELECT 1 FROM operation_templates WHERE name = 'Cutting Only');

INSERT INTO operation_templates (name, description, default_steps_json)
SELECT 'Cutting + Edging',
       'Beam saw cutting, then edge banding on all exposed edges.',
       '[{"stepOrder":1,"operationName":"Beam Saw Cutting","machineCategory":"Beam Saw","estimatedMinutes":90},{"stepOrder":2,"operationName":"Edge Banding","machineCategory":"Edge Bander","estimatedMinutes":120}]'::json
WHERE NOT EXISTS (SELECT 1 FROM operation_templates WHERE name = 'Cutting + Edging');

INSERT INTO operation_templates (name, description, default_steps_json)
SELECT 'Cutting + Edging + CNC (after edging)',
       'Cut, edge band, then CNC routing / drilling on the edged panel.',
       '[{"stepOrder":1,"operationName":"Beam Saw Cutting","machineCategory":"Beam Saw","estimatedMinutes":90},{"stepOrder":2,"operationName":"Edge Banding","machineCategory":"Edge Bander","estimatedMinutes":120},{"stepOrder":3,"operationName":"CNC Routing","machineCategory":"CNC Router","estimatedMinutes":150}]'::json
WHERE NOT EXISTS (SELECT 1 FROM operation_templates WHERE name = 'Cutting + Edging + CNC (after edging)');

INSERT INTO operation_templates (name, description, default_steps_json)
SELECT 'Cutting + CNC + Edging (before edging)',
       'Cut, CNC route / drill first, then edge band last.',
       '[{"stepOrder":1,"operationName":"Beam Saw Cutting","machineCategory":"Beam Saw","estimatedMinutes":90},{"stepOrder":2,"operationName":"CNC Routing","machineCategory":"CNC Router","estimatedMinutes":150},{"stepOrder":3,"operationName":"Edge Banding","machineCategory":"Edge Bander","estimatedMinutes":120}]'::json
WHERE NOT EXISTS (SELECT 1 FROM operation_templates WHERE name = 'Cutting + CNC + Edging (before edging)');

INSERT INTO operation_templates (name, description, default_steps_json)
SELECT 'Cutting + Edging + 36mm Pressing',
       'Cut and edge panels, press to 36mm on the Orma press, then re-cut and re-edge the pressed material.',
       '[{"stepOrder":1,"operationName":"Beam Saw Cutting","machineCategory":"Beam Saw","estimatedMinutes":90},{"stepOrder":2,"operationName":"Edge Banding","machineCategory":"Edge Bander","estimatedMinutes":120},{"stepOrder":3,"operationName":"Orma 36mm Pressing","machineCategory":"Press","estimatedMinutes":240},{"stepOrder":4,"operationName":"Re-Cut Pressed Panel (Beam Saw)","machineCategory":"Beam Saw","estimatedMinutes":60},{"stepOrder":5,"operationName":"Edge Pressed Panel","machineCategory":"Edge Bander","estimatedMinutes":90}]'::json
WHERE NOT EXISTS (SELECT 1 FROM operation_templates WHERE name = 'Cutting + Edging + 36mm Pressing');

INSERT INTO operation_templates (name, description, default_steps_json)
SELECT 'Cutting + 36mm Pressing (no pre-edge)',
       'Cut raw panels, press directly to 36mm, then re-cut and edge the pressed material.',
       '[{"stepOrder":1,"operationName":"Beam Saw Cutting","machineCategory":"Beam Saw","estimatedMinutes":90},{"stepOrder":2,"operationName":"Orma 36mm Pressing","machineCategory":"Press","estimatedMinutes":240},{"stepOrder":3,"operationName":"Re-Cut Pressed Panel (Beam Saw)","machineCategory":"Beam Saw","estimatedMinutes":60},{"stepOrder":4,"operationName":"Edge Pressed Panel","machineCategory":"Edge Bander","estimatedMinutes":90}]'::json
WHERE NOT EXISTS (SELECT 1 FROM operation_templates WHERE name = 'Cutting + 36mm Pressing (no pre-edge)');

COMMIT;
