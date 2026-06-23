-- AlterTable
ALTER TABLE "Report21Upload" ADD COLUMN "livePlanillaId" TEXT;
ALTER TABLE "Report21Upload" ADD COLUMN "livePlanillaTitulo" TEXT;
ALTER TABLE "Report21Upload" ADD COLUMN "planillaColsJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Report21Upload" ADD COLUMN "skuRowMapJson" JSONB NOT NULL DEFAULT '{}';
