-- AlterTable
ALTER TABLE "DetectedSubscription" ADD COLUMN     "categoryId" UUID,
ADD COLUMN     "detectionEvidence" JSONB,
ADD COLUMN     "userEditedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DetectedSubscription_categoryId_idx" ON "DetectedSubscription"("categoryId");

-- AddForeignKey
ALTER TABLE "DetectedSubscription" ADD CONSTRAINT "DetectedSubscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
