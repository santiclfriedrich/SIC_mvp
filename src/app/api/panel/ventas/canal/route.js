import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";
import { b2cExpr, rango, fromISO } from "@/lib/panel/ventas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const canal = (searchParams.get("canal") || "").toUpperCase();
  let periodo = searchParams.get("periodo") || "mes";
  if (canal !== "B2B" && canal !== "B2C") return Response.json({ error: "canal inválido" }, { status: 400 });
  if (!["hoy", "semana", "quincena", "mes", "anio"].includes(periodo)) periodo = "mes";

  try {
    const mxRows = await prisma.$queryRawUnsafe(`SELECT MAX(fecha) mx FROM sales`);
    const mx = mxRows[0]?.mx;
    if (!mx) return Response.json({ canal, ref: null, periodo, kpi: null, productos: [], clientes: [] });
    const ref = fromISO(mx);
    const [d, h, pd, ph] = rango(periodo, ref);

    // expr del canal: se numera una vez y se reusa en cada consulta con sus params
    const kpi = async (desde, hasta) => {
      const params = [];
      params.push(desde); const a = `$${params.length}`;
      params.push(hasta); const b = `$${params.length}`;
      const expr = b2cExpr(params);
      const chan = canal === "B2C" ? expr : `NOT ${expr}`;
      const r = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(total),0) fac, COUNT(DISTINCT comprobante) comp FROM sales WHERE fecha >= ${a} AND fecha <= ${b} AND ${chan}`,
        ...params
      );
      return { facturado: Number(r[0]?.fac || 0), comprobantes: Number(r[0]?.comp || 0) };
    };
    const act = await kpi(d, h);
    const prev = await kpi(pd, ph);
    const varPct = prev.facturado ? ((act.facturado - prev.facturado) / prev.facturado) * 100 : null;
    const ticket = act.comprobantes ? act.facturado / act.comprobantes : 0;

    const topQuery = async (sel, group, order) => {
      const params = [];
      params.push(d); const a = `$${params.length}`;
      params.push(h); const b = `$${params.length}`;
      const expr = b2cExpr(params);
      const chan = canal === "B2C" ? expr : `NOT ${expr}`;
      return prisma.$queryRawUnsafe(
        `SELECT ${sel} FROM sales WHERE fecha >= ${a} AND fecha <= ${b} AND ${chan} GROUP BY ${group} ORDER BY ${order} LIMIT 10`,
        ...params
      );
    };
    const productos = await topQuery("item_code, MAX(item_desc) item_desc, COALESCE(SUM(cantidad),0) unidades, COALESCE(SUM(total),0) facturado", "item_code", "facturado DESC");
    const clientes = await topQuery("cliente, COUNT(DISTINCT comprobante) comprobantes, COALESCE(SUM(total),0) facturado", "cliente", "facturado DESC");

    return Response.json(jsonSafe({
      canal, ref: mx, periodo, desde: d, hasta: h,
      kpi: { facturado: act.facturado, comprobantes: act.comprobantes, ticket, prev: prev.facturado, var: varPct },
      productos, clientes,
    }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
