-- AlterTable
ALTER TABLE "Import" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Update existing records to set updatedAt to createdAt
UPDATE "Import" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- Make updatedAt NOT NULL after updating existing records
ALTER TABLE "Import" ALTER COLUMN "updatedAt" SET NOT NULL;
