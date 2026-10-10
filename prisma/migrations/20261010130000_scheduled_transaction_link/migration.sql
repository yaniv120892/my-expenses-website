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
