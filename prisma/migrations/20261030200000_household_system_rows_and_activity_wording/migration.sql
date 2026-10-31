-- AlterEnum
ALTER TYPE "HouseholdActivityAction" ADD VALUE 'API_TOKEN_REVOKED';

-- AlterEnum
ALTER TYPE "HouseholdEntityType" ADD VALUE 'API_TOKEN';
ALTER TYPE "HouseholdEntityType" ADD VALUE 'ATTACHMENT';

-- AlterTable
ALTER TABLE "HouseholdActivity" ALTER COLUMN "summary" DROP NOT NULL,
ADD COLUMN     "role" "HouseholdRole";

-- DropIndex
DROP INDEX "HouseholdActivity_householdId_createdAt_idx";

-- CreateIndex
CREATE INDEX "HouseholdActivity_householdId_createdAt_id_idx" ON "HouseholdActivity"("householdId", "createdAt" DESC, "id" DESC);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Import" ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ImportedTransaction" ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ScheduledTransaction" ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserCategoryMapping" ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AutoApproveRule" ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DetectedSubscription" ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false;

-- Rows written before this migration held English sentences with raw role and
-- status values; keep only the entity's own words and move the role to its column.
UPDATE "HouseholdActivity"
SET "role" = (regexp_match("summary", '(EDITOR|VIEWER)$'))[1]::"HouseholdRole"
WHERE "action" IN ('INVITE_CREATED', 'MEMBER_JOINED', 'ROLE_CHANGED');

UPDATE "HouseholdActivity"
SET "summary" = NULL
WHERE "action" IN ('INVITE_CREATED', 'INVITE_REVOKED', 'MEMBER_JOINED', 'MEMBER_LEFT');

UPDATE "HouseholdActivity"
SET "summary" = regexp_replace("summary", '^Removed ', '')
WHERE "action" = 'MEMBER_REMOVED';

UPDATE "HouseholdActivity"
SET "summary" = regexp_replace("summary", ' is now (EDITOR|VIEWER)$', '')
WHERE "action" = 'ROLE_CHANGED';

UPDATE "HouseholdActivity"
SET "summary" = "Transaction"."description"
FROM "Transaction"
WHERE "HouseholdActivity"."entityType" = 'TRANSACTION'
  AND "HouseholdActivity"."summary" LIKE 'Status set to %'
  AND "Transaction"."id"::text = "HouseholdActivity"."entityId";
