// Helpers server-only del módulo de pricing: guard de rol y serialización de
// PricingProduct (Decimal → Number) con sus precios/renta calculados.

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { computeProduct } from "./engine.js";

/**
 * Devuelve la sesión si el usuario es TIENDAS o ADMIN; si no, devuelve un
 * objeto { error, status } para responder desde el route handler.
 */
export async function requireTiendas() {
  const session = await getServerSession(authOptions);
  if (!session) return { session: null, error: "Unauthorized", status: 401 };
  if (session.user.role !== "TIENDAS" && session.user.role !== "ADMIN") {
    return { session: null, error: "Forbidden", status: 403 };
  }
  return { session, error: null, status: 200 };
}

const num = (v) => (v == null ? 0 : Number(v));

/** PricingProduct (Prisma) → objeto plano con números nativos. */
export function productToPlain(row) {
  return {
    id: row.id,
    sku: row.sku,
    descripcion: row.descripcion || "",
    marca: row.marca || "",
    esLP: !!row.esLP,
    ivaCoef: num(row.ivaCoef) > 0 ? num(row.ivaCoef) : 1.21,
    stock: row.stock ?? 0,
    costoSinIVA: num(row.costoSinIVA),
    pesoAforado: num(row.pesoAforado),
    stockValorizado: num(row.stockValorizado),
    precios: row.preciosJson || {},
    precios3: row.precios3Json || {},
    fees: row.feesJson || {},
    report21At: row.report21At ? row.report21At.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/** Agrega el detalle por tienda (precio + renta de 1 pago y 3 CSI). */
export function withComputed(plain, config) {
  return { ...plain, tiendas: computeProduct(plain, config) };
}
