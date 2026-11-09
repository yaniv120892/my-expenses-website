-- CreateEnum
CREATE TYPE "HouseholdActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'MERGE', 'IGNORE', 'CONFIRM', 'DISMISS', 'INVITE_CREATED', 'INVITE_REVOKED', 'MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_REMOVED', 'ROLE_CHANGED');

-- CreateEnum
CREATE TYPE "HouseholdEntityType" AS ENUM ('TRANSACTION', 'IMPORT', 'IMPORTED_TRANSACTION', 'SCHEDULED_TRANSACTION', 'CATEGORY_MAPPING', 'AUTO_APPROVE_RULE', 'SUBSCRIPTION', 'INVITE', 'MEMBER');

-- AlterTable
ALTER TABLE "AutoApproveRule" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- AlterTable
ALTER TABLE "DetectedSubscription" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- AlterTable
ALTER TABLE "Import" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- AlterTable
ALTER TABLE "ImportedTransaction" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- AlterTable
ALTER TABLE "ScheduledTransaction" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- AlterTable
ALTER TABLE "UserCategoryMapping" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "updatedById" UUID;

-- CreateTable
CREATE TABLE "HouseholdActivity" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "actorUserId" UUID,
    "actorTokenId" UUID,
    "systemJob" TEXT,
    "action" "HouseholdActivityAction" NOT NULL,
    "entityType" "HouseholdEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdActivity_householdId_createdAt_idx" ON "HouseholdActivity"("householdId", "createdAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTransaction" ADD CONSTRAINT "ScheduledTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTransaction" ADD CONSTRAINT "ScheduledTransaction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryMapping" ADD CONSTRAINT "UserCategoryMapping_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryMapping" ADD CONSTRAINT "UserCategoryMapping_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApproveRule" ADD CONSTRAINT "AutoApproveRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApproveRule" ADD CONSTRAINT "AutoApproveRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedSubscription" ADD CONSTRAINT "DetectedSubscription_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectedSubscription" ADD CONSTRAINT "DetectedSubscription_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdActivity" ADD CONSTRAINT "HouseholdActivity_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdActivity" ADD CONSTRAINT "HouseholdActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: a row written before attribution was created by its writer.
UPDATE "Transaction" SET "createdById" = "userId" WHERE "userId" IS NOT NULL;
UPDATE "Import" SET "createdById" = "userId" WHERE "userId" IS NOT NULL;
UPDATE "ImportedTransaction" SET "createdById" = "userId" WHERE "userId" IS NOT NULL;
UPDATE "ScheduledTransaction" SET "createdById" = "userId" WHERE "userId" IS NOT NULL;
UPDATE "UserCategoryMapping" SET "createdById" = "userId" WHERE "userId" IS NOT NULL;
UPDATE "AutoApproveRule" SET "createdById" = "userId" WHERE "userId" IS NOT NULL;
UPDATE "DetectedSubscription" SET "createdById" = "userId" WHERE "userId" IS NOT NULL;
