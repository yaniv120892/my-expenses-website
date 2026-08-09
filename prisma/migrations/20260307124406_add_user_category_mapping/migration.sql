-- CreateTable
CREATE TABLE "UserCategoryMapping" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "descriptionPattern" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCategoryMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCategoryMapping_userId_idx" ON "UserCategoryMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCategoryMapping_userId_descriptionPattern_key" ON "UserCategoryMapping"("userId", "descriptionPattern");

-- AddForeignKey
ALTER TABLE "UserCategoryMapping" ADD CONSTRAINT "UserCategoryMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCategoryMapping" ADD CONSTRAINT "UserCategoryMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
