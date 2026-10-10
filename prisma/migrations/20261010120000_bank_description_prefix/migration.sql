-- AlterTable
ALTER TABLE "ScheduledTransaction" ADD COLUMN "bankDescriptionPrefix" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "bankDescriptionPrefix" TEXT;
