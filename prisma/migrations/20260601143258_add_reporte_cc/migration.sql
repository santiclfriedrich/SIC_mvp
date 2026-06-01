-- CreateTable
CREATE TABLE "ReporteCC" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "spreadsheetUrl" TEXT NOT NULL,
    "totalDeuda" DECIMAL(14,2) NOT NULL,
    "totalClientes" INTEGER NOT NULL,
    "totalComp" INTEGER NOT NULL,
    "excluidos" INTEGER NOT NULL DEFAULT 0,
    "clientesJson" JSONB NOT NULL,
    "porVendedorJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReporteCC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReporteCC_userId_createdAt_idx" ON "ReporteCC"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReporteCC" ADD CONSTRAINT "ReporteCC_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
