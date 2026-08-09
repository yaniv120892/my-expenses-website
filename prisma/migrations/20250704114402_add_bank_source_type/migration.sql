-- CreateEnum
CREATE TYPE "ImportBankSourceType" AS ENUM ('NON_BANK_CREDIT', 'BANK_CREDIT');

-- AlterTable
ALTER TABLE "Import" ADD COLUMN     "bankSourceType" "ImportBankSourceType";
