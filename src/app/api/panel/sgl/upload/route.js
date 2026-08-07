import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { replaceSglStock } from "@/lib/panel/sgl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SKU_HEADERS = new Set(["sku", "codigo", "código", "cod", "cod.", "articulo", "artículo", "item", "item_code", "codigo articulo", "código artículo", "codigo_articulo"]);
const QTY_HEADERS = new Set(["cantidad", "stock", "qty", "cant", "cant.", "unidades", "existencia", "existencias", "fisico", "físico", "stock fisico", "stock físico", "disponible"]);

function parseRows(data) {
  let skuCol = null, qtyCol = null, descCol = null, headerRow = null;
  for (let idx = 0; idx < Math.min(15, data.length); idx++) {
    const cells = (data[idx] || []).map((c) => String(c ?? "").trim().toLowerCase());
    const s = cells.findIndex((c) => SKU_HEADERS.has(c));
    const qi = cells.findIndex((c) => QTY_HEADERS.has(c));
    if (s !== -1 && qi !== -1) {
      skuCol = s; qtyCol = qi; headerRow = idx;
      const dc = cells.findIndex((c, j) => j !== s && j !== qi && (c.includes("desc") || c.includes("articulo") || c.includes("artículo")));
      descCol = dc === -1 ? null : dc;
      break;
    }
  }
  if (headerRow === null) {
    throw new Error("No encontré las columnas. El archivo debe tener encabezados tipo 'Codigo'/'SKU' y 'Cantidad'/'Stock'.");
  }
  const out = {};
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i] || [];
    if (skuCol >= row.length) continue;
    const sku = String(row[skuCol] ?? "").trim().toUpperCase();
    if (!sku) continue;
    const qn = parseFloat(String(row[qtyCol] ?? "0").replace(",", "."));
    if (!Number.isFinite(qn)) continue;
    const descr = descCol != null && descCol < row.length ? String(row[descCol] ?? "").trim() : "";
    const prev = out[sku] || { qty: 0, descr: "" };
    out[sku] = { qty: prev.qty + qn, descr: prev.descr || descr };
  }
  return Object.entries(out).map(([sku, v]) => ({ sku, qty: v.qty, descr: v.descr }));
}

export async function POST(request) {
  let file;
  try { const form = await request.formData(); file = form.get("file"); } catch {}
  if (!file || typeof file === "string") return Response.json({ error: "no llegó ningún archivo" }, { status: 400 });
  const name = (file.name || "").toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let data;
  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      const wb = XLSX.read(buf, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = buf.toString("utf-8").replace(/^﻿/, "");
      const delim = text.split(";").length >= text.split(",").length ? ";" : ",";
      data = text.split(/\r?\n/).map((line) => line.split(delim));
    } else {
      return Response.json({ error: "Formato no soportado: subí un .xlsx o .csv" }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: `No se pudo leer el archivo: ${e?.message || e}` }, { status: 400 });
  }

  let rows;
  try { rows = parseRows(data); } catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 400 }); }
  if (!rows.length) return Response.json({ error: "el archivo no tiene filas con datos" }, { status: 400 });

  const info = { at: new Date().toISOString(), file: file.name || null, rows: rows.length, source: "archivo" };
  try { await replaceSglStock(prisma, rows, info); }
  catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 500 }); }
  return Response.json({ ok: true, rows: rows.length });
}
