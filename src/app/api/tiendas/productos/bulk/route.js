import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTiendas } from "@/lib/pricing/server";
import { getPricingConfig } from "@/lib/pricing/config";
import { inverseStore, rentaRandom } from "@/lib/pricing/engine";
import { empujarEnViva } from "@/lib/pricing/sheet-sync";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/tiendas/productos/bulk
 * Alta masiva con auto-precio: recibe { skus: string[] } (o { texto }), busca
 * cada SKU en el report21, calcula el precio de 1 pago de CADA tienda activa a
 * una renta aleatoria 4–5% (inversa), y los upsertea. Luego sincroniza esas
 * filas en la planilla viva. El 3 CSI queda derivado.
 */
export async function POST(req) {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON)" }, { status: 400 });
  }

  // Acepta lista o texto (separado por coma / espacio / salto de línea).
  let skus = Array.isArray(body?.skus) ? body.skus : [];
  if (!skus.length && typeof body?.texto === "string") {
    skus = body.texto.split(/[\s,;]+/);
  }
  skus = [...new Set(skus.map((s) => String(s).trim()).filter(Boolean))];
  if (!skus.length) return NextResponse.json({ error: "No se recibieron SKUs" }, { status: 400 });
  if (skus.length > 2000) {
    return NextResponse.json({ error: "Demasiados SKUs de una vez (máx 2000)" }, { status: 400 });
  }

  const config = await getPricingConfig();
  const activos = Object.values(config.stores).filter((s) => s.activo && s.pagos?.["1pago"]);

  const [existentes, bases] = await Promise.all([
    prisma.pricingProduct.findMany({ where: { sku: { in: skus } } }),
    prisma.report21Row.findMany({ where: { sku: { in: skus } } }),
  ]);
  const existMap = new Map(existentes.map((p) => [p.sku, p]));
  const baseMap = new Map(bases.map((b) => [b.sku, b]));

  const num = (v) => (v == null ? 0 : Number(v));
  const creados = [];
  const actualizados = [];
  const noEncontrados = [];
  const afectados = [];

  for (const sku of skus) {
    const prod = existMap.get(sku);
    const base = prod || baseMap.get(sku);
    if (!base) {
      noEncontrados.push(sku);
      continue;
    }

    const plain = {
      costoSinIVA: num(base.costoSinIVA),
      pesoAforado: num(base.pesoAforado),
      esLP: !!base.esLP,
      ivaCoef: num(base.ivaCoef) > 0 ? num(base.ivaCoef) : 1.21,
      fees: prod?.feesJson || {},
    };

    // Auto-precio: cada tienda con su propia renta aleatoria 4–5%.
    const precios = {};
    for (const s of activos) {
      const p = inverseStore(s, "1pago", plain, rentaRandom(0.04, 0.05, Math.random()), config);
      if (Number.isFinite(p) && p > 0) precios[s.key] = Math.round(p);
    }

    if (prod) {
      const saved = await prisma.pricingProduct.update({
        where: { sku },
        data: { preciosJson: { ...(prod.preciosJson || {}), ...precios }, precios3Json: {} },
      });
      actualizados.push(sku);
      afectados.push(saved);
    } else {
      const saved = await prisma.pricingProduct.create({
        data: {
          sku,
          descripcion: base.descripcion,
          marca: base.marca,
          esLP: base.esLP,
          ivaCoef: base.ivaCoef,
          stock: base.stock,
          costoSinIVA: base.costoSinIVA,
          pesoAforado: base.pesoAforado,
          stockValorizado: base.stockValorizado,
          preciosJson: precios,
          precios3Json: {},
          report21At: new Date(),
        },
      });
      creados.push(sku);
      afectados.push(saved);
    }
  }

  // Sincroniza las filas afectadas en la planilla viva (best-effort).
  let sync = null;
  try {
    if (afectados.length) sync = await empujarEnViva(afectados, config);
  } catch (e) {
    sync = { ok: false, motivo: e?.message };
  }

  return NextResponse.json({
    ok: true,
    total: skus.length,
    creados: creados.length,
    actualizados: actualizados.length,
    noEncontrados,
    sync,
  });
}
