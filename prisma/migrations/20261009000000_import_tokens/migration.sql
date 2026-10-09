-- A long-lived bearer accepted only by the import routes. The token itself is
-- shown once at creation; only its SHA-256 is stored.
CREATE TABLE "ImportToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportToken_tokenHash_key" ON "ImportToken"("tokenHash");

CREATE INDEX "ImportToken_userId_idx" ON "ImportToken"("userId");

ALTER TABLE "ImportToken" ADD CONSTRAINT "ImportToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
