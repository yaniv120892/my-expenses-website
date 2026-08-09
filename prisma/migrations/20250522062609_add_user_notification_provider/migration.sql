-- CreateEnum
CREATE TYPE "NotificationProvider" AS ENUM ('TELEGRAM');

-- CreateTable
CREATE TABLE "UserNotificationProvider" (
    "userId" UUID NOT NULL,
    "provider" "NotificationProvider" NOT NULL,
    "data" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserNotificationProvider_pkey" PRIMARY KEY ("userId","provider")
);

-- AddForeignKey
ALTER TABLE "UserNotificationProvider" ADD CONSTRAINT "UserNotificationProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
