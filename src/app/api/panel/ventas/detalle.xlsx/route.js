import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { b2cExpr, sucursalLike } from "@/lib/panel/ventas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const num = (x) => (x == null ? 0 : Number(x) || 0);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const canal = searchParams.get("canal");
  if (!desde || !hasta) return Response.json({ error: "faltan fechas" }, { status: 400 });

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
  const w = where.join(" AND ");

  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT fecha, comprobante, tipo, cliente, clase_cliente, condicion, vendedor, sucursal,
              item_code, item_desc, marca, categoria, subcategoria, cantidad, neto, total, tc
         FROM sales WHERE ${w} ORDER BY fecha, comprobante`,
      ...params
    );
    const heads = ["Fecha", "Comprobante", "Tipo", "Cliente", "Clase de cliente", "Condición de venta",
      "Vendedor", "Sucursal", "Código", "Descripción", "Marca", "Categoría", "SubCategoría",
      "Cantidad", "P. Unit. c/IVA", "P. Unit. neto", "Neto", "Total", "TC"];
    const aoa = [heads];
    for (const r of rows) {
      const cant = num(r.cantidad);
      const total = num(r.total), neto = num(r.neto);
      const uni = cant ? total / cant : 0;
      const uniNeto = cant ? neto / cant : 0;
      aoa.push([r.fecha, r.comprobante, r.tipo, r.cliente, r.clase_cliente, r.condicion, r.vendedor,
        r.sucursal, r.item_code, r.item_desc, r.marca, r.categoria, r.subcategoria,
        cant, uni, uniNeto, neto, total, r.tc == null ? null : num(r.tc)]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [11, 20, 5, 30, 16, 22, 18, 16, 13, 42, 15, 20, 18, 9, 14, 14, 13, 13, 10].map((wch) => ({ wch }));
    for (let R = 1; R < aoa.length; R++) {
      const set = (c, z) => { const cell = ws[XLSX.utils.encode_cell({ r: R, c })]; if (cell && cell.t === "n") cell.z = z; };
      set(13, "#,##0");
      for (const c of [14, 15, 16, 17, 18]) set(c, "#,##0.00");
    }
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: heads.length - 1 } }) };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ventas_${desde}_${hasta}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
