-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('DETECTED', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SubscriptionFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "UserNotificationPreference" ADD COLUMN     "subscriptionAudit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DetectedSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "merchantName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "averageAmount" DOUBLE PRECISION NOT NULL,
    "frequency" "SubscriptionFrequency" NOT NULL,
    "lastChargeDate" TIMESTAMP(3) NOT NULL,
    "nextExpectedDate" TIMESTAMP(3) NOT NULL,
    "annualCost" DOUBLE PRECISION NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DETECTED',
    "matchingDescriptions" TEXT[],
    "scheduledTransactionId" UUID,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectedSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DetectedSubscription_userId_idx" ON "DetectedSubscription"("userId");

-- CreateIndex
CREATE INDEX "DetectedSubscription_status_idx" ON "DetectedSubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DetectedSubscription_userId_merchantName_frequency_key" ON "DetectedSubscription"("userId", "merchantName", "frequency");

-- AddForeignKey
ALTER TABLE "DetectedSubscription" ADD CONSTRAINT "DetectedSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
