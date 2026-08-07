import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";
import { b2cExpr, rango, fromISO, facturaPeriodo } from "@/lib/panel/ventas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ETI = { hoy: "Hoy", semana: "Esta semana", quincena: "Esta quincena", mes: "Este mes", anio: "Este año" };
const PREV = { hoy: "ayer", semana: "sem. anterior", quincena: "quinc. anterior", mes: "mes anterior", anio: "año anterior" };

async function meta(key) {
  const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = '${key}'`);
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

export async function GET() {
  try {
    const info = await meta("ventas_info");
    const mxRows = await prisma.$queryRawUnsafe(`SELECT MAX(fecha) mx FROM sales`);
    const mx = mxRows[0]?.mx;
    if (!mx) return Response.json({ info, cards: [], canales: [] });
    const ref = fromISO(mx);

    const cards = [];
    for (const clave of ["hoy", "semana", "quincena", "mes", "anio"]) {
      const [d, h, pd, ph] = rango(clave, ref);
      const act = await facturaPeriodo(prisma, d, h);
      const prev = await facturaPeriodo(prisma, pd, ph);
      const varPct = prev.facturado ? ((act.facturado - prev.facturado) / prev.facturado) * 100 : null;
      cards.push({ clave, titulo: ETI[clave], prev_titulo: PREV[clave], facturado: act.facturado, comprobantes: act.comprobantes, prev: prev.facturado, var: varPct, desde: d, hasta: h });
    }

    // canales B2B/B2C del mes en curso (reusa el mismo expr/placeholders 2 veces)
    const params = [];
    const expr = b2cExpr(params);
    const [d] = rango("mes", ref);
    const h = rango("mes", ref)[1];
    params.push(d); const pd = `$${params.length}`;
    params.push(h); const ph = `$${params.length}`;
    const fila = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(CASE WHEN ${expr} THEN total ELSE 0 END),0) b2c,
              COALESCE(SUM(CASE WHEN ${expr} THEN 0 ELSE total END),0) b2b
         FROM sales WHERE fecha >= ${pd} AND fecha <= ${ph}`,
      ...params
    );
    const canales = [
      { clave: "B2C", titulo: "B2C (web + ML)", facturado: Number(fila[0]?.b2c || 0) },
      { clave: "B2B", titulo: "B2B (corporativo/mayorista)", facturado: Number(fila[0]?.b2b || 0) },
    ];
    return Response.json(jsonSafe({ info, ref: mx, cards, canales }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
