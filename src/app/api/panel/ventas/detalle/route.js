import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";
import { b2cExpr, sucursalLike } from "@/lib/panel/ventas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const canal = searchParams.get("canal");
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  if (!desde || !hasta) return Response.json({ total: 0, facturado: 0, rows: [] });

  const params = [];
  params.push(desde); const pd = `$${params.length}`;
  params.push(hasta); const ph = `$${params.length}`;
  const where = [`fecha >= ${pd} AND fecha <= ${ph}`];
  if (canal === "B2C" || canal === "B2B") {
    const expr = b2cExpr(params);
    where.push(canal === "B2C" ? expr : `NOT ${expr}`);
  }
  const suc = sucursalLike(searchParams.get("sucursal"));
  if (suc) { params.push(suc); where.push(`sucursal LIKE $${params.length}`); }
  if (q) {
    params.push(`%${q}%`); const p = `$${params.length}`;
    where.push(`(LOWER(item_code) LIKE ${p} OR LOWER(item_desc) LIKE ${p} OR LOWER(cliente) LIKE ${p} OR LOWER(comprobante) LIKE ${p})`);
  }
  const w = where.join(" AND ");
  try {
    const totalRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) c FROM sales WHERE ${w}`, ...params);
    const factRows = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(total),0) s FROM sales WHERE ${w}`, ...params);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT fecha, comprobante, tipo, cliente, clase_cliente, condicion, vendedor, sucursal,
              item_code, item_desc, marca, categoria, cantidad, neto, total, tc
         FROM sales WHERE ${w} ORDER BY fecha DESC, comprobante LIMIT 1000`,
      ...params
    );
    return Response.json(jsonSafe({ total: Number(totalRows[0]?.c || 0), facturado: Number(factRows[0]?.s || 0), rows }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
