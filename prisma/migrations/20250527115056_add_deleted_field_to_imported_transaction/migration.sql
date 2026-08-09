/*
  Warnings:

  - The `status` column on the `ImportedTransaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ImportedTransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'MERGED', 'IGNORED');

-- AlterTable
ALTER TABLE "ImportedTransaction" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "status",
ADD COLUMN     "status" "ImportedTransactionStatus" NOT NULL DEFAULT 'PENDING';
