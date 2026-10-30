-- Households, step 1: every user gets a household of their own as its owner,
-- and every household-owned row learns its household. The row columns stay
-- nullable here; the scoping migration that follows sets the rows written in
-- between and makes them required.

CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

CREATE TABLE "Household" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "householdId" UUID,
ADD COLUMN "householdRole" "HouseholdRole" NOT NULL DEFAULT 'OWNER',
ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- A fresh id rather than the user's own, so no code path can pass a user id
-- where a household id belongs and still find the right rows.
UPDATE "User" SET "householdId" = gen_random_uuid();
INSERT INTO "Household" ("id") SELECT "householdId" FROM "User";

ALTER TABLE "User" ALTER COLUMN "householdId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_householdId_idx" ON "User"("householdId");

ALTER TABLE "Transaction" ADD COLUMN "householdId" UUID;
ALTER TABLE "Import" ADD COLUMN "householdId" UUID;
ALTER TABLE "ImportedTransaction" ADD COLUMN "householdId" UUID;
ALTER TABLE "ScheduledTransaction" ADD COLUMN "householdId" UUID;
ALTER TABLE "UserCategoryMapping" ADD COLUMN "householdId" UUID;
ALTER TABLE "AutoApproveRule" ADD COLUMN "householdId" UUID;
ALTER TABLE "DetectedSubscription" ADD COLUMN "householdId" UUID;

UPDATE "Transaction" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."userId" = owner."id";
UPDATE "Import" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."userId" = owner."id";
UPDATE "ImportedTransaction" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."userId" = owner."id";
UPDATE "ScheduledTransaction" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."userId" = owner."id";
UPDATE "UserCategoryMapping" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."userId" = owner."id";
UPDATE "AutoApproveRule" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."userId" = owner."id";
UPDATE "DetectedSubscription" AS row SET "householdId" = owner."householdId" FROM "User" AS owner WHERE row."userId" = owner."id";

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Import" ADD CONSTRAINT "Import_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduledTransaction" ADD CONSTRAINT "ScheduledTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserCategoryMapping" ADD CONSTRAINT "UserCategoryMapping_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutoApproveRule" ADD CONSTRAINT "AutoApproveRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DetectedSubscription" ADD CONSTRAINT "DetectedSubscription_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Invite" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'EDITOR',
    "createdById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedById" UUID,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
CREATE INDEX "Invite_householdId_idx" ON "Invite"("householdId");

ALTER TABLE "Invite" ADD CONSTRAINT "Invite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
