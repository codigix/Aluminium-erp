-- Migration: Add dimension fields to stock_entry_items
-- This allows manual stock entries to store shape-wise dimensions
-- for dimension-accurate stock balance tracking.

ALTER TABLE `stock_entry_items`
  ADD COLUMN `shape_id`         INT            NULL AFTER `material_type`,
  ADD COLUMN `length`           DECIMAL(12,3)  NULL AFTER `shape_id`,
  ADD COLUMN `width`            DECIMAL(12,3)  NULL AFTER `length`,
  ADD COLUMN `thickness`        DECIMAL(12,3)  NULL AFTER `width`,
  ADD COLUMN `diameter`         DECIMAL(12,3)  NULL AFTER `thickness`,
  ADD COLUMN `outer_diameter`   DECIMAL(12,3)  NULL AFTER `diameter`,
  ADD COLUMN `weight_per_unit`  DECIMAL(12,4)  NULL AFTER `outer_diameter`;
