/*
  Warnings:

  - You are about to drop the column `public_id` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `public_id` ON `users`;

-- DropIndex
DROP INDEX `public_id_2` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `public_id`;
