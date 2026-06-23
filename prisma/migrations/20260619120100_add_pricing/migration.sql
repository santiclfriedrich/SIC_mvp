-- CreateTable
CREATE TABLE "PricingProduct" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "descripcion" TEXT,
    "marca" TEXT,
    "esLP" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "costoSinIVA" DECIMAL(16,4) NOT NULL,
    "pesoAforado" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "stockValorizado" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "preciosJson" JSONB NOT NULL DEFAULT '{}',
    "report21At" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "configJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingProduct_sku_key" ON "PricingProduct"("sku");
