// Planilla VIVA: una sola copia persistente del molde donde la web escribe los
// precios al instante (las % se recalculan con las fórmulas originales).
// Server-only (usa el cliente de Google + Prisma).

import { prisma } from "@/lib/prisma";
import { PLANILLA_COLS } from "./stores.js";
import {
  copiarComoSheet,
  compartirConLink,
  listarSheets,
  leerRango,
  valoresBatchUpdate,
} from "@/lib/reportes-cc/google-client";

// Índice de columna (0-based) → letra A1 (119 → "DP").
export function colLetter(i) {
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

export const sheetRef = (title) => `'${String(title).replace(/'/g, "''")}'`;

/**
 * Crea (o re-crea) la planilla viva copiando el molde. Detecta la hoja
 * principal, las columnas de precios/LP y el mapa SKU→fila, y guarda todo en
 * Report21Upload. Devuelve { spreadsheetId, spreadsheetUrl }.
 */
export async function crearPlanillaViva() {
  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  if (!meta?.moldeFileId) {
    throw new Error("No hay molde guardado. Subí la planilla (.xlsx) primero.");
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const { spreadsheetId, spreadsheetUrl } = await copiarComoSheet(
    meta.moldeFileId,
    `Planilla Tiendas (VIVA) — ${fecha}`
  );

  // Hoja principal.
  const sheets = await listarSheets(spreadsheetId);
  const titulo = Object.keys(sheets).find((t) => /cobramos|ajuste/i.test(t));
  if (!titulo) throw new Error("El molde no tiene la hoja principal.");

  // Headers (fila ~9) → índices de columna.
  const head = await leerRango(spreadsheetId, `${sheetRef(titulo)}!A1:GZ15`);
  let hr = -1;
  for (let i = 0; i < head.length; i++) {
    if ((head[i] || []).some((c) => norm(c) === "sku")) { hr = i; break; }
  }
  if (hr === -1) throw new Error("No se encontró la fila de headers (SKU).");
  const headers = (head[hr] || []).map(norm);
  const find = (alias) => headers.findIndex((h) => alias.map(norm).includes(h));

  const cols = {}; // clave → letra A1
  for (const [storeKey, pagos] of Object.entries(PLANILLA_COLS.precios)) {
    for (const [pago, alias] of Object.entries(pagos)) {
      const i = find(alias);
      if (i !== -1) cols[`${storeKey}-${pago}`] = colLetter(i);
    }
  }
  const iLP = find(PLANILLA_COLS.iibLP);
  const iIB = find(PLANILLA_COLS.ingresosBrutos);
  if (iLP !== -1) cols.iibLP = colLetter(iLP);
  if (iIB !== -1) cols.ingresosBrutos = colLetter(iIB);

  const skuCol = headers.indexOf("sku");
  const skuColLetter = colLetter(skuCol);
  const dataStart = hr + 2;
  const skuVals = await leerRango(
    spreadsheetId,
    `${sheetRef(titulo)}!${skuColLetter}${dataStart}:${skuColLetter}${dataStart + 5000}`
  );
  const skuRowMap = {};
  skuVals.forEach((r, idx) => {
    const sku = String(r?.[0] ?? "").trim();
    if (sku && skuRowMap[sku] == null) skuRowMap[sku] = dataStart + idx;
  });

  await compartirConLink(spreadsheetId, "writer");

  await prisma.report21Upload.update({
    where: { id: 1 },
    data: {
      livePlanillaId: spreadsheetId,
      livePlanillaTitulo: titulo,
      planillaColsJson: cols,
      skuRowMapJson: skuRowMap,
    },
  });

  return { spreadsheetId, spreadsheetUrl, titulo, skus: Object.keys(skuRowMap).length };
}

/**
 * Escribe la fila de un SKU en la planilla viva: precios 1 pago + 3 CSI de cada
 * tienda activa + IIB LP / Ingresos brutos (según LP). Best-effort: si no hay
 * planilla viva o el SKU no tiene fila, no hace nada.
 * @param {object} meta  fila Report21Upload (con livePlanillaId, cols, skuRowMap)
 * @param {object} productoComputed  salida de withComputed (tiene .tiendas y .esLP)
 */
export async function escribirFilaEnViva(meta, productoComputed) {
  if (!meta?.livePlanillaId) return { ok: false, motivo: "sin planilla viva" };
  const cols = meta.planillaColsJson || {};
  const skuRowMap = meta.skuRowMapJson || {};
  const fila = skuRowMap[productoComputed.sku];
  if (!fila) return { ok: false, motivo: "SKU no está en la planilla" };

  const titulo = meta.livePlanillaTitulo;
  const data = [];
  const set = (colKey, value) => {
    const letra = cols[colKey];
    if (!letra) return;
    data.push({ range: `${sheetRef(titulo)}!${letra}${fila}`, values: [[value]] });
  };

  for (const t of productoComputed.tiendas || []) {
    set(`${t.storeKey}-1pago`, t.precio1Pago != null ? t.precio1Pago : "");
    if (cols[`${t.storeKey}-3csi`]) {
      set(`${t.storeKey}-3csi`, t.precio3CSI != null ? t.precio3CSI : "");
    }
  }
  // LP → IIB LP 5,5% / Ingresos brutos 0% ; no-LP al revés.
  set("iibLP", productoComputed.esLP ? 0.055 : 0);
  set("ingresosBrutos", productoComputed.esLP ? 0 : 0.055);

  if (data.length === 0) return { ok: false, motivo: "sin columnas" };
  await valoresBatchUpdate(meta.livePlanillaId, data);
  return { ok: true, celdas: data.length };
}
