import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTiendas, productToPlain } from "@/lib/pricing/server";
import { PLANILLA_MAP } from "@/lib/pricing/stores";
import {
  copiarComoSheet,
  compartirConLink,
  listarSheets,
  leerRango,
  valoresBatchUpdate,
} from "@/lib/reportes-cc/google-client";

export const runtime = "nodejs";
export const maxDuration = 120;

// Índice de columna (0-based) → letra A1 (119 → "DP").
function colLetter(i) {
  let n = i;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const sheetRef = (title) => `'${String(title).replace(/'/g, "''")}'`;

/**
 * POST /api/tiendas/sheets
 * Copia la planilla MOLDE (conserva hojas/formato/fórmulas) y reemplaza, en la
 * hoja principal, los precios de 1 pago de cada tienda con los de la web. Las %
 * se recalculan solas con las fórmulas originales.
 */
export async function POST() {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [rows, meta] = await Promise.all([
    prisma.pricingProduct.findMany({ orderBy: { sku: "asc" } }),
    prisma.report21Upload.findUnique({ where: { id: 1 } }),
  ]);

  if (!meta?.moldeFileId) {
    return NextResponse.json(
      { error: "No hay molde guardado. Subí la planilla (.xlsx) primero." },
      { status: 422 }
    );
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No hay precios cargados para exportar." }, { status: 422 });
  }
  const productos = rows.map(productToPlain);

  const fecha = new Date().toISOString().slice(0, 10);

  let spreadsheetId, spreadsheetUrl;
  try {
    // 1) Copia del molde, convertida a Google Sheet.
    const out = await copiarComoSheet(meta.moldeFileId, `Precios Tiendas — ${fecha}`);
    spreadsheetId = out.spreadsheetId;
    spreadsheetUrl = out.spreadsheetUrl;

    // 2) Ubicar la hoja principal.
    const sheets = await listarSheets(spreadsheetId);
    const titulo = Object.keys(sheets).find((t) => /cobramos|ajuste/i.test(t));
    if (!titulo) {
      return NextResponse.json(
        { error: "El molde no tiene la hoja principal ('AJUSTE formula cobramos-ganamo').", spreadsheetUrl },
        { status: 422 }
      );
    }

    // 3) Detectar fila de headers y columnas (SKU + PRECIO-* por tienda).
    const head = await leerRango(spreadsheetId, `${sheetRef(titulo)}!A1:GZ15`);
    let hr = -1;
    for (let i = 0; i < head.length; i++) {
      if ((head[i] || []).some((c) => norm(c) === "sku")) {
        hr = i;
        break;
      }
    }
    if (hr === -1) {
      return NextResponse.json({ error: "No se encontró la fila de headers (SKU) en la hoja principal.", spreadsheetUrl }, { status: 422 });
    }
    const headers = (head[hr] || []).map(norm);
    const skuCol = headers.indexOf("sku");
    const precioColIdx = {};
    for (const [storeKey, alias] of Object.entries(PLANILLA_MAP.precioCols)) {
      const i = headers.findIndex((h) => alias.map(norm).includes(h));
      if (i !== -1) precioColIdx[storeKey] = i;
    }

    // 4) Mapear SKU → número de fila (1-based) leyendo la columna de SKU.
    const skuColLetter = colLetter(skuCol);
    const dataStart = hr + 2; // fila (1-based) donde empiezan los datos
    const skuVals = await leerRango(
      spreadsheetId,
      `${sheetRef(titulo)}!${skuColLetter}${dataStart}:${skuColLetter}${dataStart + 5000}`
    );
    const filaDe = new Map();
    skuVals.forEach((r, i) => {
      const sku = String(r?.[0] ?? "").trim();
      if (sku && !filaDe.has(sku)) filaDe.set(sku, dataStart + i);
    });

    // 5) Armar las escrituras: precio de cada tienda en su celda.
    const data = [];
    let escritos = 0;
    let sinFila = 0;
    for (const p of productos) {
      const fila = filaDe.get(p.sku);
      if (!fila) {
        sinFila++;
        continue;
      }
      for (const [storeKey, ci] of Object.entries(precioColIdx)) {
        const precio = Number(p.precios?.[storeKey]);
        if (precio > 0) {
          data.push({ range: `${sheetRef(titulo)}!${colLetter(ci)}${fila}`, values: [[precio]] });
          escritos++;
        }
      }
    }

    // 6) Escribir en lotes.
    for (let i = 0; i < data.length; i += 500) {
      await valoresBatchUpdate(spreadsheetId, data.slice(i, i + 500));
    }

    // 7) Compartir por link.
    await compartirConLink(spreadsheetId, "writer");

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      spreadsheetUrl,
      embedUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`,
      hoja: titulo,
      escritos,
      sinFila,
    });
  } catch (e) {
    console.error("Error generando Sheet de tiendas:", e);
    return NextResponse.json(
      { error: "Error al generar el Sheet: " + e.message, spreadsheetUrl },
      { status: 500 }
    );
  }
}
