-- IF [NOT] EXISTS: an earlier revision of this change ran on the preview
-- database and added both prefix columns.

-- AlterTable
ALTER TABLE "ScheduledTransaction" ADD COLUMN IF NOT EXISTS "bankDescriptionPrefix" TEXT;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "bankDescriptionPrefix";
ALTER TABLE "Transaction" ADD COLUMN "scheduledTransactionId" UUID;

-- CreateIndex
CREATE INDEX "Transaction_scheduledTransactionId_idx" ON "Transaction"("scheduledTransactionId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_scheduledTransactionId_fkey" FOREIGN KEY ("scheduledTransactionId") REFERENCES "ScheduledTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rows the cron projected before this column existed carry no link, so a
-- prefix set later would never reach them. The cron copies the schedule's
-- description and type verbatim, which identifies the schedule unless two of
-- a user's schedules share them; those stay unlinked.
UPDATE "Transaction" AS t
SET "scheduledTransactionId" = s.id
FROM "ScheduledTransaction" AS s
WHERE t.status = 'PENDING_APPROVAL'
  AND t."scheduledTransactionId" IS NULL
  AND t."userId" = s."userId"
  AND t.description = s.description
  AND t.type = s.type
  AND NOT EXISTS (
    SELECT 1 FROM "ScheduledTransaction" AS other
    WHERE other."userId" = s."userId"
      AND other.description = s.description
      AND other.type = s.type
      AND other.id <> s.id
  );
