-- AlterTable
ALTER TABLE "ScheduledTransaction" ALTER COLUMN "userId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "userId" DROP DEFAULT;

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "userId" UUID NOT NULL,
    "createTransaction" BOOLEAN NOT NULL DEFAULT false,
    "dailySummary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
