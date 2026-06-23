-- CreateTable
CREATE TABLE "Report21Row" (
    "sku" TEXT NOT NULL,
    "descripcion" TEXT,
    "marca" TEXT,
    "esLP" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "costoSinIVA" DECIMAL(16,4) NOT NULL,
    "pesoAforado" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "stockValorizado" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report21Row_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "Report21Upload" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fuente" TEXT NOT NULL,
    "filas" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report21Upload_pkey" PRIMARY KEY ("id")
);
