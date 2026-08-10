-- CreateEnum
CREATE TYPE "TransactionFileStatus" AS ENUM ('ACTIVE', 'MARKED_FOR_DELETION', 'DELETED');

-- CreateTable
CREATE TABLE "TransactionFile" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "TransactionFileStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionFile_transactionId_idx" ON "TransactionFile"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionFile_status_idx" ON "TransactionFile"("status");

-- AddForeignKey
ALTER TABLE "TransactionFile" ADD CONSTRAINT "TransactionFile_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
