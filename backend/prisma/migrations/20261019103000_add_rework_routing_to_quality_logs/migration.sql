-- AlterTable
ALTER TABLE `job_card_quality_logs` ADD COLUMN `rework_routing_type` VARCHAR(30) NULL DEFAULT 'SAME_OPERATION',
    ADD COLUMN `rework_target_job_card_id` INT NULL;
