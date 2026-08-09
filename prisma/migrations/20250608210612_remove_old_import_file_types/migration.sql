/*
  Warnings:

  - The values [CAL_CREDIT,ISRACARD_CREDIT] on the enum `ImportFileType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ImportFileType_new" AS ENUM ('VISA_CREDIT', 'MASTERCARD_CREDIT', 'AMERICAN_EXPRESS_CREDIT');
ALTER TABLE "Import" ALTER COLUMN "importType" TYPE "ImportFileType_new" USING ("importType"::text::"ImportFileType_new");
ALTER TYPE "ImportFileType" RENAME TO "ImportFileType_old";
ALTER TYPE "ImportFileType_new" RENAME TO "ImportFileType";
DROP TYPE "ImportFileType_old";
COMMIT;
