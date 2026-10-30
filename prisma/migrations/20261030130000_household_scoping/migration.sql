-- Households, step 2: the household is now the owner and every filter. Rows
-- written by code that predates step 1 are backfilled again before the column
-- becomes required. userId stays as who wrote the row, so it may be null for
-- a write no member made.

UPDATE "Transaction" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."householdId" IS NULL AND row."userId" = owner."id";
UPDATE "Import" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."householdId" IS NULL AND row."userId" = owner."id";
UPDATE "ImportedTransaction" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."householdId" IS NULL AND row."userId" = owner."id";
UPDATE "ScheduledTransaction" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."householdId" IS NULL AND row."userId" = owner."id";
UPDATE "UserCategoryMapping" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."householdId" IS NULL AND row."userId" = owner."id";
UPDATE "AutoApproveRule" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."householdId" IS NULL AND row."userId" = owner."id";
UPDATE "DetectedSubscription" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."householdId" IS NULL AND row."userId" = owner."id";

-- DropForeignKey
ALTER TABLE "AutoApproveRule" DROP CONSTRAINT "AutoApproveRule_userId_fkey";

-- DropForeignKey
ALTER TABLE "DetectedSubscription" DROP CONSTRAINT "DetectedSubscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Import" DROP CONSTRAINT "Import_userId_fkey";

-- DropForeignKey
ALTER TABLE "ImportedTransaction" DROP CONSTRAINT "ImportedTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledTransaction" DROP CONSTRAINT "ScheduledTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserCategoryMapping" DROP CONSTRAINT "UserCategoryMapping_userId_fkey";

-- DropIndex
DROP INDEX "AutoApproveRule_userId_idx";

-- DropIndex
DROP INDEX "DetectedSubscription_userId_idx";

-- DropIndex
DROP INDEX "DetectedSubscription_userId_merchantName_frequency_key";

-- DropIndex
DROP INDEX "Import_userId_deleted_createdAt_idx";

-- DropIndex
DROP INDEX "ImportedTransaction_userId_idx";

-- DropIndex
DROP INDEX "ScheduledTransaction_userId_nextRunDate_idx";

-- DropIndex
DROP INDEX "Transaction_userId_idx";

-- DropIndex
DROP INDEX "Transaction_userId_status_date_idx";

-- DropIndex
DROP INDEX "UserCategoryMapping_userId_descriptionPattern_key";

-- DropIndex
DROP INDEX "UserCategoryMapping_userId_idx";

-- AlterTable
ALTER TABLE "AutoApproveRule" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DetectedSubscription" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Import" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ImportedTransaction" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ScheduledTransaction" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "householdId" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserCategoryMapping" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "householdId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AutoApproveRule_householdId_idx" ON "AutoApproveRule"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "DetectedSubscription_householdId_merchantName_frequency_key" ON "DetectedSubscription"("householdId", "merchantName", "frequency");

-- CreateIndex
CREATE INDEX "Import_householdId_deleted_createdAt_idx" ON "Import"("householdId", "deleted", "createdAt");

-- CreateIndex
CREATE INDEX "ImportedTransaction_householdId_idx" ON "ImportedTransaction"("householdId");

-- CreateIndex
CREATE INDEX "ScheduledTransaction_householdId_nextRunDate_idx" ON "ScheduledTransaction"("householdId", "nextRunDate");

-- CreateIndex
CREATE INDEX "Transaction_householdId_status_date_idx" ON "Transaction"("householdId", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UserCategoryMapping_householdId_descriptionPattern_key" ON "UserCategoryMapping"("householdId", "descriptionPattern");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTransaction" ADD CONSTRAINT "ScheduledTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryMapping" ADD CONSTRAINT "UserCategoryMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApproveRule" ADD CONSTRAINT "AutoApproveRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedSubscription" ADD CONSTRAINT "DetectedSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

