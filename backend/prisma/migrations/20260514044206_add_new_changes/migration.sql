/*
  Warnings:

  - You are about to drop the column `cloumn_test` on the `vendors` table. All the data in the column will be lost.
  - You are about to drop the column `dummy_test` on the `vendors` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `vendors` DROP COLUMN `cloumn_test`,
    DROP COLUMN `dummy_test`,
    ADD COLUMN `dummy_name` VARCHAR(100) NULL;
