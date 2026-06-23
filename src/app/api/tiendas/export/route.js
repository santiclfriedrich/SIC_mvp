import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireTiendas, productToPlain, withComputed } from "@/lib/pricing/server";
import { getPricingConfig } from "@/lib/pricing/config";
import { buildExportRows } from "@/lib/pricing/export";

export const runtime = "nodejs";

/**
 * GET /api/tiendas/export?mode=pegar|full
 * Descarga un .xlsx con los precios actuales (modo "pegar" = listo para copiar,
 * modo "full" = desglose con % de renta).
 */
export async function GET(req) {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const mode = new URL(req.url).searchParams.get("mode") === "full" ? "full" : "pegar";

  const [rows, config] = await Promise.all([
    prisma.pricingProduct.findMany({ orderBy: { sku: "asc" } }),
    getPricingConfig(),
  ]);
  const productos = rows.map((r) => withComputed(productToPlain(r), config));

  const { headers, rows: dataRows } = buildExportRows(productos, config, mode);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, mode === "full" ? "Precios" : "Para pegar");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const fecha = new Date().toISOString().slice(0, 10);
  const filename = `precios-tiendas-${mode}-${fecha}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
