-- AlterTable
ALTER TABLE "ScheduledTransaction" ADD COLUMN     "userId" UUID NOT NULL DEFAULT 'eda12bcb-5836-41d3-b153-d11079da4256';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "userId" UUID NOT NULL DEFAULT 'eda12bcb-5836-41d3-b153-d11079da4256';

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledTransaction" ADD CONSTRAINT "ScheduledTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
