-- Configure Work Order: operations added / edited for ONE production plan (the BOM is not changed).
-- op_ref = 'BOM:<sales_order_item_operations.id>' or 'PPO:<production_plan_operations.id>' → edit of that operation;
-- op_ref NULL → an operation added to the plan. Used when the plan's operations are listed and when work orders are created.
-- New table only; nothing existing is changed. Safe to run more than once.
CREATE TABLE IF NOT EXISTS `production_plan_op_overrides` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `plan_id` INT NOT NULL,
  `op_ref` VARCHAR(50) NULL,
  `operation_name` VARCHAR(255) NOT NULL,
  `workstation` VARCHAR(255) NULL,
  `process_type` VARCHAR(50) NULL,
  `cycle_time_min` DECIMAL(12,3) NULL,
  `setup_time_min` DECIMAL(12,3) NULL,
  `hourly_rate` DECIMAL(12,2) NULL,
  `source_item` VARCHAR(255) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ppoo_plan` (`plan_id`),
  UNIQUE KEY `uq_ppoo_plan_ref` (`plan_id`, `op_ref`)
);
