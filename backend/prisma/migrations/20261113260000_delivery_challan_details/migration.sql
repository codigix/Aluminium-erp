-- Delivery Challan (print of an outward sub-contract challan): user edits to the printed fields.
-- One row per outward challan. NULL / missing values fall back to the system values
-- (dispatch date, outward challan no., customer PO from the job card, job-card part + released materials).
-- lines_json = JSON array of {main, sub, qty, remarks}; NULL = use the system lines.
-- Print only: outward challan, job card and stock quantities are NOT changed.
-- New table only; nothing existing is changed. Safe to run more than once.
CREATE TABLE IF NOT EXISTS `delivery_challan_details` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `outward_challan_id` INT NOT NULL,
  `dc_date` DATE NULL,
  `your_ch_no` VARCHAR(100) NULL,
  `your_ch_date` DATE NULL,
  `po_no` VARCHAR(100) NULL,
  `po_date` DATE NULL,
  `vehicle_no` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `lines_json` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dcd_outward_challan` (`outward_challan_id`)
);
