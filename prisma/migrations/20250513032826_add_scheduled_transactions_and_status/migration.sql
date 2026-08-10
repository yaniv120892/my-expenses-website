-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('APPROVED', 'PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateTable
CREATE TABLE "ScheduledTransaction" (
    "id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "type" "TransactionType" NOT NULL,
    "categoryId" UUID NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL,
    "interval" INTEGER,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "monthOfYear" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "lastRunDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3),

    CONSTRAINT "ScheduledTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScheduledTransaction" ADD CONSTRAINT "ScheduledTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
