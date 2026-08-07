import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { VIS, SGL_COMPARE_STORAGE } from "@/lib/panel/query";
import { buildItemsSql } from "@/lib/panel/items-sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const num = (x) => (x == null ? null : Number(x));
const STOR_LIST = VIS.split(",").map((s) => parseInt(s, 10)); // [1,19,17,31,30]

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const { selectSql, params, esCosto } = buildItemsSql(searchParams);
  try {
    const rows = await prisma.$queryRawUnsafe(selectSql, ...params);

    const storNameRows = await prisma.$queryRawUnsafe(
      `SELECT stor_id, stor_name FROM storages WHERE stor_id IN (${VIS})`
    );
    const storNames = {};
    for (const r of storNameRows) storNames[Number(r.stor_id)] = r.stor_name;

    const pivot = {};
    const stockRows = await prisma.$queryRawUnsafe(
      `SELECT item_id, stor_id, fs FROM stock WHERE stor_id IN (${VIS})`
    );
    for (const r of stockRows) {
      const it = Number(r.item_id);
      (pivot[it] ||= {})[Number(r.stor_id)] = num(r.fs);
    }

    // SGL puede no existir en la base unificada: tolerar ausencia
    let sglMap = {};
    try {
      const sglRows = await prisma.$queryRawUnsafe(`SELECT sku, qty FROM sgl_stock`);
      for (const r of sglRows) sglMap[(r.sku || "").toString()] = num(r.qty);
    } catch { sglMap = {}; }
    const hasSgl = Object.keys(sglMap).length > 0;

    // columnas de depósito en orden del panel, con SGL después de TML (19)
    const storCols = [];
    for (const sid of STOR_LIST) {
      storCols.push({ kind: "stor", sid, name: storNames[sid] || `Dep ${sid}` });
      if (sid === SGL_COMPARE_STORAGE && hasSgl) {
        storCols.push({ kind: "sgl", sid: null, name: "Sincro SGL" });
      }
    }

    const headers = [
      "Código", "Descripción", "Part number", "Categoría", "Marca",
      ...storCols.map((c) => c.name),
      "Físico total", "Disponible",
      esCosto ? "Costo" : "Precio", "Moneda",
      esCosto ? "Valorizado a costo" : "Valorizado",
    ];

    const aoa = [headers];
    for (const r of rows) {
      const porDep = pivot[Number(r.item_id)] || {};
      const sku = (r.item_code || "").trim().toUpperCase();
      const depVals = storCols.map((c) =>
        (c.kind === "sgl" ? sglMap[sku] : porDep[c.sid]) || 0
      );
      aoa.push([
        r.item_code, r.item_desc, r.vendor_code, r.cat_desc, r.brand_desc,
        ...depVals,
        num(r.unidades) || 0, num(r.disponibles) || 0,
        num(r.price), r.curr || "ARS", num(r.valor) || 0,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const nDep = storCols.length;
    const nCols = headers.length;

    // anchos de columna
    const widths = [14, 55, 20, 26, 16, ...Array(nDep).fill(13), 12, 12, 14, 9, 16];
    ws["!cols"] = widths.map((wch) => ({ wch }));

    // formatos numéricos: enteros (dep + físico + disp), y 2 decimales (precio, valor)
    const firstNum = 5;                 // 0-based: primera col numérica (col F)
    const priceCol = 5 + nDep + 2;      // Costo/Precio (0-based)
    const valorCol = 5 + nDep + 4;      // Valorizado (0-based)
    for (let R = 1; R < aoa.length; R++) {
      for (let C = firstNum; C < priceCol; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.t === "n") cell.z = "#,##0";
      }
      const pc = ws[XLSX.utils.encode_cell({ r: R, c: priceCol })];
      if (pc && pc.t === "n") pc.z = "#,##0.00";
      const vc = ws[XLSX.utils.encode_cell({ r: R, c: valorCol })];
      if (vc && vc.t === "n") vc.z = "#,##0.00";
    }

    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: nCols - 1 } }) };
    ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="stock_${stamp()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
