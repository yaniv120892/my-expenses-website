-- AlterTable
ALTER TABLE "Import" ADD COLUMN     "excelExtractionRequestId" TEXT,
ALTER COLUMN "importType" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Import_excelExtractionRequestId_idx" ON "Import"("excelExtractionRequestId");
