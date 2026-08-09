-- CreateTable
CREATE TABLE "AutoApproveRule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "descriptionPattern" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoApproveRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoApproveRule_userId_idx" ON "AutoApproveRule"("userId");

-- AddForeignKey
ALTER TABLE "AutoApproveRule" ADD CONSTRAINT "AutoApproveRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApproveRule" ADD CONSTRAINT "AutoApproveRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
