-- AlterTable
ALTER TABLE `users` ADD COLUMN `last_verification_sent` DATETIME(3) NULL,
    ADD COLUMN `verification_attempts` INTEGER NOT NULL DEFAULT 0;
