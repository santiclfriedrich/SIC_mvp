import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTiendas, productToPlain, withComputed } from "@/lib/pricing/server";
import { getPricingConfig } from "@/lib/pricing/config";
import { limpiarFilaEnViva } from "@/lib/pricing/sheet-sync";

export const runtime = "nodejs";

/**
 * GET /api/tiendas/productos/[sku]
 * Devuelve el producto priceado si existe; si no, los datos base del report21
 * (para el panel de "setear precio" al dar de alta un SKU nuevo).
 */
export async function GET(_req, { params }) {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { sku } = await params;
  const skuNorm = String(sku || "").trim();
  const config = await getPricingConfig();

  const prod = await prisma.pricingProduct.findUnique({ where: { sku: skuNorm } });
  if (prod) {
    return NextResponse.json({ existe: true, producto: withComputed(productToPlain(prod), config) });
  }

  const base = await prisma.report21Row.findUnique({ where: { sku: skuNorm } });
  if (!base) {
    return NextResponse.json(
      { existe: false, base: null, error: "SKU no encontrado en el report21" },
      { status: 404 }
    );
  }

  // Producto "virtual" (no persistido) con base enriquecida y sin precios.
  const plain = {
    id: null,
    sku: base.sku,
    descripcion: base.descripcion || "",
    marca: base.marca || "",
    esLP: base.esLP,
    ivaCoef: Number(base.ivaCoef) > 0 ? Number(base.ivaCoef) : 1.21,
    stock: base.stock,
    costoSinIVA: Number(base.costoSinIVA),
    pesoAforado: Number(base.pesoAforado),
    stockValorizado: Number(base.stockValorizado),
    precios: {},
    precios3: {},
    fees: {},
    report21At: base.updatedAt.toISOString(),
    updatedAt: null,
  };
  return NextResponse.json({ existe: false, base: withComputed(plain, config) });
}

/** DELETE /api/tiendas/productos/[sku] — quita el SKU de la lista de precios. */
export async function DELETE(_req, { params }) {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { sku } = await params;
  const skuNorm = String(sku).trim();
  try {
    await prisma.pricingProduct.delete({ where: { sku: skuNorm } });
  } catch {
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  }
  // Limpia su fila en la planilla viva (best-effort).
  let sync = null;
  try {
    sync = await limpiarFilaEnViva(skuNorm);
  } catch (e) {
    sync = { ok: false, motivo: e?.message };
  }
  return NextResponse.json({ ok: true, sync });
}
