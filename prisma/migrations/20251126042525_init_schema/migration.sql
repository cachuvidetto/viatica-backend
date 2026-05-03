/*
  Warnings:

  - You are about to drop the column `created_at` on the `licenses` table. All the data in the column will be lost.
  - You are about to drop the column `expiry_date` on the `licenses` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `licenses` table. All the data in the column will be lost.
  - You are about to drop the column `seats` on the `licenses` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `licenses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[license_hash]` on the table `licenses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiration_date` to the `licenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `license_hash` to the `licenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `license_type` to the `licenses` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `licenses_key_key` ON `licenses`;

-- AlterTable
ALTER TABLE `licenses` DROP COLUMN `created_at`,
    DROP COLUMN `expiry_date`,
    DROP COLUMN `key`,
    DROP COLUMN `seats`,
    DROP COLUMN `type`,
    ADD COLUMN `expiration_date` DATETIME(3) NOT NULL,
    ADD COLUMN `is_free` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `issue_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `last_activity` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `license_hash` VARCHAR(191) NOT NULL,
    ADD COLUMN `license_type` VARCHAR(191) NOT NULL,
    ADD COLUMN `pc_uuid` VARCHAR(191) NULL,
    ADD COLUMN `seat_number` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `username` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `licenses_license_hash_key` ON `licenses`(`license_hash`);
