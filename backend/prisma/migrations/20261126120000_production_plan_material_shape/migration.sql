-- Production plan materials: store the shape of each material line (e.g. "Hexagonal Bar", "Square Bar").
-- Before this, the shape was not saved and was looked up again from the BOM by name + sizes when the plan was
-- reopened, so two lines with the same material and sizes but different shapes showed the same shape label.
-- Added to production_plan_materials: shape_type VARCHAR(100) NULL.
-- NULL = not stored (plans saved before this change); those keep the old BOM lookup. Quantities are not affected.
-- Additive; existing rows unchanged. Safe to run more than once.
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_plan_materials' AND COLUMN_NAME = 'shape_type');
SET @ddl = IF(@col_exists = 0, 'ALTER TABLE `production_plan_materials` ADD COLUMN `shape_type` VARCHAR(100) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
