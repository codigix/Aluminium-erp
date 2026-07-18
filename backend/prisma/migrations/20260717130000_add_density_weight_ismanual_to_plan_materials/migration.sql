-- AlterTable
ALTER TABLE `production_plan_materials`
    ADD COLUMN `density` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    ADD COLUMN `weight_per_unit` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    ADD COLUMN `is_manual` BOOLEAN NOT NULL DEFAULT 0;
