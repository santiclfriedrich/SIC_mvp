import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTiendas, productToPlain, withComputed } from "@/lib/pricing/server";
import { getPricingConfig } from "@/lib/pricing/config";
import { escribirFilaEnViva } from "@/lib/pricing/sheet-sync";

export const runtime = "nodejs";

// Responde con el producto calculado y, best-effort, sincroniza su fila en la
// planilla viva (si existe). Nunca falla el guardado por un error de Sheets.
async function responder(prod, config) {
  const computed = withComputed(productToPlain(prod), config);
  let sync = null;
  try {
    const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
    sync = await escribirFilaEnViva(meta, computed);
  } catch (e) {
    sync = { ok: false, motivo: e.message };
  }
  return NextResponse.json({ ok: true, producto: computed, sync });
}

/** GET /api/tiendas/productos — lista de productos priceados con renta calculada. */
export async function GET() {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [rows, config] = await Promise.all([
    prisma.pricingProduct.findMany({ orderBy: { updatedAt: "desc" } }),
    getPricingConfig(),
  ]);

  const productos = rows.map((r) => withComputed(productToPlain(r), config));
  return NextResponse.json({ productos });
}

/**
 * POST /api/tiendas/productos
 * Setea/actualiza el precio de 1 pago de un SKU en una tienda.
 * body: { sku, store, precio, esLP? }
 *   - precio null o 0 → elimina ese precio.
 * Si el SKU no existe aún, lo crea tomando los datos base del último report21.
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

  const sku = String(body?.sku || "").trim();
  const store = String(body?.store || "").trim();
  const pago = body?.pago === "3csi" ? "3csi" : "1pago"; // default 1 pago
  const precio = body?.precio == null || body?.precio === "" ? null : Number(body.precio);

  if (!sku) return NextResponse.json({ error: "Falta sku" }, { status: 400 });

  const config = await getPricingConfig();

  // --- Actualización SÓLO de LP (sin tocar precios): body { sku, esLP } ---
  if (!store && typeof body?.esLP === "boolean") {
    let prod = await prisma.pricingProduct.findUnique({ where: { sku } });
    if (prod) {
      prod = await prisma.pricingProduct.update({ where: { sku }, data: { esLP: body.esLP } });
    } else {
      const base = await prisma.report21Row.findUnique({ where: { sku } });
      if (!base) {
        return NextResponse.json({ error: `El SKU ${sku} no está en el report21.` }, { status: 404 });
      }
      prod = await prisma.pricingProduct.create({
        data: {
          sku,
          descripcion: base.descripcion,
          marca: base.marca,
          esLP: body.esLP,
          ivaCoef: base.ivaCoef,
          stock: base.stock,
          costoSinIVA: base.costoSinIVA,
          pesoAforado: base.pesoAforado,
          stockValorizado: base.stockValorizado,
          report21At: new Date(),
        },
      });
    }
    return responder(prod, config);
  }

  if (!store) return NextResponse.json({ error: "Falta store" }, { status: 400 });
  if (precio != null && (!Number.isFinite(precio) || precio < 0)) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }

  if (!config.stores[store]?.activo) {
    return NextResponse.json({ error: `Tienda desconocida o inactiva: ${store}` }, { status: 400 });
  }
  if (pago === "3csi" && !config.stores[store].pagos?.["3csi"]) {
    return NextResponse.json({ error: `${store} no tiene 3 CSI` }, { status: 400 });
  }

  let prod = await prisma.pricingProduct.findUnique({ where: { sku } });

  if (!prod) {
    const base = await prisma.report21Row.findUnique({ where: { sku } });
    if (!base) {
      return NextResponse.json(
        { error: `El SKU ${sku} no está en el report21. Subí/actualizá el report21 primero.` },
        { status: 404 }
      );
    }
    prod = await prisma.pricingProduct.create({
      data: {
        sku,
        descripcion: base.descripcion,
        marca: base.marca,
        esLP: typeof body?.esLP === "boolean" ? body.esLP : base.esLP,
        ivaCoef: base.ivaCoef,
        stock: base.stock,
        costoSinIVA: base.costoSinIVA,
        pesoAforado: base.pesoAforado,
        stockValorizado: base.stockValorizado,
        preciosJson: pago === "1pago" && precio != null ? { [store]: precio } : {},
        precios3Json: pago === "3csi" && precio != null ? { [store]: precio } : {},
        report21At: new Date(),
      },
    });
  } else {
    const precios = { ...(prod.preciosJson || {}) };
    const precios3 = { ...(prod.precios3Json || {}) };

    if (pago === "1pago") {
      // Editar 1 pago: setea el precio y RESETEA el 3CSI a "derivado" (saca override).
      if (precio == null) delete precios[store];
      else precios[store] = precio;
      delete precios3[store];
    } else {
      // Editar 3CSI: queda independiente (override). No toca el 1 pago.
      if (precio == null) delete precios3[store];
      else precios3[store] = precio;
    }

    prod = await prisma.pricingProduct.update({
      where: { sku },
      data: {
        preciosJson: precios,
        precios3Json: precios3,
        ...(typeof body?.esLP === "boolean" ? { esLP: body.esLP } : {}),
      },
    });
  }

  return responder(prod, config);
}
