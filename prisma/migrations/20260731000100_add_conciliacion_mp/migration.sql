-- CreateTable
CREATE TABLE "ConciliacionMP" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "spreadsheetUrl" TEXT NOT NULL,
    "gbpOps" INTEGER NOT NULL,
    "cobradas" INTEGER NOT NULL,
    "pendientes" INTEGER NOT NULL,
    "sobrantes" INTEGER NOT NULL,
    "montoCobrado" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "montoPendiente" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "montoSobrante" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "resumenJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciliacionMP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConciliacionMP_userId_createdAt_idx" ON "ConciliacionMP"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConciliacionMP" ADD CONSTRAINT "ConciliacionMP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
