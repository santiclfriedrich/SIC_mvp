// Helpers de ventas portados de app.py (rango de comparativas, canal B2C/B2B,
// facturación por período, filtro de sucursal).

export const VENTAS_B2C_CONDICIONES = ["MercadoPago ML", "Mercado Pago + Boton en FC", "Venta FullJaus"];
export const VENTAS_B2C_PREFIJOS = ["Tienda "];
const SUC_LIKE = { arg: "01.%", skop: "05.%" };

/** Empuja los params del canal B2C a `params` y devuelve la expresión SQL con
 *  los placeholders $n correctos (Postgres permite reusar el mismo $n). */
export function b2cExpr(params) {
  const parts = [];
  for (const c of VENTAS_B2C_CONDICIONES) { params.push(c); parts.push(`condicion = $${params.length}`); }
  for (const p of VENTAS_B2C_PREFIJOS) { params.push(p + "%"); parts.push(`condicion LIKE $${params.length}`); }
  return parts.length ? `(${parts.join(" OR ")})` : "(1=0)";
}

export function sucursalLike(sucursal) {
  const s = (sucursal || "").trim().toLowerCase();
  return SUC_LIKE[s] || null;
}

const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => new Date(`${s}T00:00:00`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diffDays = (a, b) => Math.round((a - b) / 86400000);

/** (desde, hasta, desde_prev, hasta_prev) para cada card, con el período
 *  anterior cubriendo los mismos días transcurridos. `ref` es un Date. */
export function rango(clave, ref) {
  if (clave === "hoy") {
    const p = addDays(ref, -1);
    return [iso(ref), iso(ref), iso(p), iso(p)];
  }
  if (clave === "semana") {
    const wd = (ref.getDay() + 6) % 7; // lunes = 0
    const ini = addDays(ref, -wd);
    const pini = addDays(ini, -7);
    const pfin = addDays(pini, diffDays(ref, ini));
    return [iso(ini), iso(ref), iso(pini), iso(pfin)];
  }
  if (clave === "quincena") {
    let ini, pini, prevFin;
    if (ref.getDate() <= 15) {
      ini = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const lastPrev = addDays(ini, -1);
      pini = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 16);
      prevFin = lastPrev;
    } else {
      ini = new Date(ref.getFullYear(), ref.getMonth(), 16);
      pini = new Date(ref.getFullYear(), ref.getMonth(), 1);
      prevFin = new Date(ref.getFullYear(), ref.getMonth(), 15);
    }
    let pfin = addDays(pini, diffDays(ref, ini));
    if (pfin > prevFin) pfin = prevFin;
    return [iso(ini), iso(ref), iso(pini), iso(pfin)];
  }
  if (clave === "mes") {
    const ini = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const lastPrev = addDays(ini, -1);
    const pini = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
    const prevFin = lastPrev;
    let pfin = addDays(pini, diffDays(ref, ini));
    if (pfin > prevFin) pfin = prevFin;
    return [iso(ini), iso(ref), iso(pini), iso(pfin)];
  }
  // anio
  const ini = new Date(ref.getFullYear(), 0, 1);
  const pini = new Date(ref.getFullYear() - 1, 0, 1);
  const pfin = new Date(ref.getFullYear() - 1, ref.getMonth(), ref.getDate());
  return [iso(ini), iso(ref), iso(pini), iso(pfin)];
}

/** Facturación total en [desde, hasta]. */
export async function facturaPeriodo(prisma, desde, hasta) {
  const r = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(total),0) f, COUNT(DISTINCT comprobante) c FROM sales WHERE fecha >= $1 AND fecha <= $2`,
    desde, hasta
  );
  return { facturado: Number(r[0]?.f || 0), comprobantes: Number(r[0]?.c || 0) };
}
