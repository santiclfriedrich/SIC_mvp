import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { diferenciasRows } from "@/lib/panel/diferencias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const solo = (searchParams.get("solo") ?? "1") !== "0";
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const sort = searchParams.get("sort") || "desvio";
  const dirDesc = searchParams.get("dir") !== "asc";

  const estadoTxt = (r) =>
    r.estado === "solo_gbp" ? "solo en GBP" :
    r.estado === "solo_sgl" ? "solo en SGL" :
    r.estado === "ok" ? "OK" :
    r.diff > 0 ? `GBP +${r.diff}` : `SGL +${-r.diff}`;

  try {
    const { rows } = await diferenciasRows(prisma, { solo, q, sort, dirDesc });
    const headers = ["SKU", "Descripción", "GBP (TML)", "SGL", "Diferencia", "Desvío a costo", "Estado"];
    const aoa = [headers];
    for (const r of rows) {
      aoa.push([r.sku, r.desc, r.gbp, r.sgl, r.diff, Math.abs(r.valor_diff || 0), estadoTxt(r)]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [14, 46, 11, 9, 11, 16, 16].map((wch) => ({ wch }));
    for (let R = 1; R < aoa.length; R++) {
      for (const C of [2, 3, 4]) {
        const c = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (c && c.t === "n") c.z = "#,##0";
      }
      const f = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
      if (f && f.t === "n") f.z = "#,##0.00";
    }
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: 6 } }) };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Diferencias TML");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="diferencias_tml.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
