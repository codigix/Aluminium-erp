-- Stock Entry material type fix (safe to run more than once).
-- The Stock Entry form saved the material GRADE (EN 8, SS 304, HT … from the Materials master) as material_type,
-- which everywhere else is the ITEM GROUP (RAW_MATERIAL / BOUGHT_OUT / CONSUMBLES). This:
--   1) adds stock_entry_items.material_grade;
--   2) for rows whose material_type is a material grade (and not an item group), in stock_entry_items, stock_ledger
--      and stock_balance: keeps the grade in material_grade and sets material_type to the item's group
--      (the single group used by the same item code in Item Master, else BOUGHT_OUT for BO- codes, else RAW_MATERIAL).
-- Quantities, weights, rates, sizes and dates are not touched. Items whose fixed Item Master row would duplicate an
-- existing row (same item, warehouse and sizes) are skipped and left as they are.

-- 1) Column
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_entry_items' AND COLUMN_NAME = 'material_grade'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE `stock_entry_items` ADD COLUMN `material_grade` VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2a) Material grades that are not item groups (normalised: upper case, spaces / hyphens → _)
DROP TEMPORARY TABLE IF EXISTS tmp_fix_grades;
CREATE TEMPORARY TABLE tmp_fix_grades AS
SELECT UPPER(REPLACE(REPLACE(TRIM(m.name), ' ', '_'), '-', '_')) AS norm_name, MIN(m.name) AS grade_name, MIN(m.id) AS material_id
FROM materials m
WHERE m.name IS NOT NULL AND TRIM(m.name) <> ''
  AND UPPER(REPLACE(REPLACE(TRIM(m.name), ' ', '_'), '-', '_')) NOT IN
      ('RAW_MATERIAL','BOUGHT_OUT','CONSUMBLES','CONSUMABLES','FG','FINISHED_GOOD','FINISHED_GOODS','SUB_ASSEMBLY','ASSEMBLY','PART','SA')
  AND NOT EXISTS (SELECT 1 FROM item_groups ig
                  WHERE UPPER(REPLACE(REPLACE(TRIM(ig.name), ' ', '_'), '-', '_')) = UPPER(REPLACE(REPLACE(TRIM(m.name), ' ', '_'), '-', '_')))
GROUP BY UPPER(REPLACE(REPLACE(TRIM(m.name), ' ', '_'), '-', '_'));

-- 2b) Item group per item code (only when Item Master uses exactly one group for it)
DROP TEMPORARY TABLE IF EXISTS tmp_fix_item_group;
CREATE TEMPORARY TABLE tmp_fix_item_group AS
SELECT sb.item_code, MIN(UPPER(REPLACE(REPLACE(TRIM(sb.material_type), ' ', '_'), '-', '_'))) AS grp
FROM stock_balance sb
WHERE UPPER(REPLACE(REPLACE(TRIM(sb.material_type), ' ', '_'), '-', '_')) IN ('RAW_MATERIAL','BOUGHT_OUT','CONSUMBLES','CONSUMABLES')
GROUP BY sb.item_code
HAVING COUNT(DISTINCT UPPER(REPLACE(REPLACE(TRIM(sb.material_type), ' ', '_'), '-', '_'))) = 1;

-- 2c) Items to skip: a grade-typed Item Master row that has a twin (same item, warehouse, sizes) with another type
DROP TEMPORARY TABLE IF EXISTS tmp_fix_skip;
CREATE TEMPORARY TABLE tmp_fix_skip AS
SELECT DISTINCT b.item_code
FROM stock_balance b
JOIN tmp_fix_grades g ON g.norm_name = UPPER(REPLACE(REPLACE(TRIM(b.material_type), ' ', '_'), '-', '_'))
JOIN stock_balance o ON o.item_code = b.item_code AND o.id <> b.id
  AND COALESCE(o.warehouse, '') = COALESCE(b.warehouse, '')
  AND COALESCE(o.material_type, '') <> COALESCE(b.material_type, '')
  AND ABS(COALESCE(o.length, 0) - COALESCE(b.length, 0)) < 0.0001
  AND ABS(COALESCE(o.width, 0) - COALESCE(b.width, 0)) < 0.0001
  AND ABS(COALESCE(o.thickness, 0) - COALESCE(b.thickness, 0)) < 0.0001
  AND ABS(COALESCE(o.diameter, 0) - COALESCE(b.diameter, 0)) < 0.0001
  AND ABS(COALESCE(o.outer_diameter, 0) - COALESCE(b.outer_diameter, 0)) < 0.0001;

-- 2d) Stock entry lines
UPDATE stock_entry_items x
JOIN tmp_fix_grades g ON g.norm_name = UPPER(REPLACE(REPLACE(TRIM(x.material_type), ' ', '_'), '-', '_'))
LEFT JOIN tmp_fix_item_group ig ON ig.item_code = x.item_code
SET x.material_grade = COALESCE(NULLIF(TRIM(x.material_grade), ''), g.grade_name),
    x.material_type = COALESCE(ig.grp, CASE WHEN UPPER(x.item_code) LIKE 'BO-%' THEN 'BOUGHT_OUT' ELSE 'RAW_MATERIAL' END)
WHERE x.item_code NOT IN (SELECT item_code FROM tmp_fix_skip);

-- 2e) Stock ledger
UPDATE stock_ledger x
JOIN tmp_fix_grades g ON g.norm_name = UPPER(REPLACE(REPLACE(TRIM(x.material_type), ' ', '_'), '-', '_'))
LEFT JOIN tmp_fix_item_group ig ON ig.item_code = x.item_code
SET x.material_grade = COALESCE(NULLIF(TRIM(x.material_grade), ''), g.grade_name),
    x.material_type = COALESCE(ig.grp, CASE WHEN UPPER(x.item_code) LIKE 'BO-%' THEN 'BOUGHT_OUT' ELSE 'RAW_MATERIAL' END)
WHERE x.item_code NOT IN (SELECT item_code FROM tmp_fix_skip);

-- 2f) Item Master / stock balance
UPDATE stock_balance x
JOIN tmp_fix_grades g ON g.norm_name = UPPER(REPLACE(REPLACE(TRIM(x.material_type), ' ', '_'), '-', '_'))
LEFT JOIN tmp_fix_item_group ig ON ig.item_code = x.item_code
SET x.material_grade = COALESCE(NULLIF(TRIM(x.material_grade), ''), g.grade_name),
    x.material_id = COALESCE(x.material_id, g.material_id),
    x.material_type = COALESCE(ig.grp, CASE WHEN UPPER(x.item_code) LIKE 'BO-%' THEN 'BOUGHT_OUT' ELSE 'RAW_MATERIAL' END)
WHERE x.item_code NOT IN (SELECT item_code FROM tmp_fix_skip);

DROP TEMPORARY TABLE IF EXISTS tmp_fix_grades;
DROP TEMPORARY TABLE IF EXISTS tmp_fix_item_group;
DROP TEMPORARY TABLE IF EXISTS tmp_fix_skip;
