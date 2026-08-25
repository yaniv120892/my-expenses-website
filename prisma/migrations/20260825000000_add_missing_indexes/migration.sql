-- DropIndex
DROP INDEX "Import_userId_idx";

-- CreateIndex
CREATE INDEX "AutoApproveRule_categoryId_idx" ON "AutoApproveRule"("categoryId");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Import_userId_deleted_createdAt_idx" ON "Import"("userId", "deleted", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduledTransaction_nextRunDate_idx" ON "ScheduledTransaction"("nextRunDate");

-- CreateIndex
CREATE INDEX "ScheduledTransaction_userId_nextRunDate_idx" ON "ScheduledTransaction"("userId", "nextRunDate");

-- CreateIndex
CREATE INDEX "ScheduledTransaction_categoryId_idx" ON "ScheduledTransaction"("categoryId");

-- CreateIndex
CREATE INDEX "UserCategoryMapping_categoryId_idx" ON "UserCategoryMapping"("categoryId");

