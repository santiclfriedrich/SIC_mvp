// Parser de la hoja principal de la planilla ("AJUSTE formula cobramos-ganamo").
// Importa, por SKU, los datos base + los precios de 1 pago ya seteados en las
// columnas PRECIO-* de cada tienda, para poder visualizarlos sin recargarlos.

import { PLANILLA_MAP, detectarLP } from "./stores.js";

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Busca el índice de columna según una lista de alias (normalizados). */
function findCol(headers, alias) {
  for (const a of alias) {
    const i = headers.indexOf(norm(a));
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * @param {any[][]} rows  filas de la hoja principal (header:1)
 * @returns {{ items: object[], total: number, headerRow: number, columnas: object }}
 */
export function parsePlanillaPrecios(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { items: [], total: 0, headerRow: -1, columnas: {} };
  }

  // La fila de headers de la planilla es la que tiene "SKU" (suele ser la fila 9).
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    if ((rows[i] || []).some((c) => norm(c) === "sku")) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) return { items: [], total: 0, headerRow: -1, columnas: {} };

  const headers = (rows[headerRow] || []).map(norm);
  const col = {
    sku: findCol(headers, PLANILLA_MAP.sku),
    costoSinIVA: findCol(headers, PLANILLA_MAP.costoSinIVA),
    pesoAforado: findCol(headers, PLANILLA_MAP.pesoAforado),
    descripcion: findCol(headers, PLANILLA_MAP.descripcion),
    marca: findCol(headers, PLANILLA_MAP.marca),
    stock: findCol(headers, PLANILLA_MAP.stock),
    stockValorizado: findCol(headers, PLANILLA_MAP.stockValorizado),
    ivaCoef: findCol(headers, PLANILLA_MAP.ivaCoef),
    iibLP: findCol(headers, PLANILLA_MAP.iibLP),
  };
  if (col.sku === -1) return { items: [], total: 0, headerRow, columnas: col };

  const precioCols = {};
  for (const [storeKey, alias] of Object.entries(PLANILLA_MAP.precioCols)) {
    const i = findCol(headers, alias);
    if (i !== -1) precioCols[storeKey] = i;
  }
  const feeCols = {};
  for (const [storeKey, alias] of Object.entries(PLANILLA_MAP.feeCols)) {
    const i = findCol(headers, alias);
    if (i !== -1) feeCols[storeKey] = i;
  }

  const items = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const sku = String(row[col.sku] ?? "").trim();
    if (!sku) continue;

    const precios = {};
    for (const [storeKey, ci] of Object.entries(precioCols)) {
      const p = toNumber(row[ci]);
      if (p > 0) precios[storeKey] = p;
    }
    // Sólo importamos SKUs que tengan al menos un precio cargado.
    if (Object.keys(precios).length === 0) continue;

    // Fee manual por tienda, tal cual la planilla (para reproducir la renta).
    // Se importa el valor literal INCLUIDO el 0 explícito: la planilla a veces
    // usa fee 0, y hay que respetarlo (si no, caería al lookup por peso y daría
    // una renta distinta a la de la planilla).
    const fees = {};
    for (const [storeKey, ci] of Object.entries(feeCols)) {
      fees[storeKey] = toNumber(row[ci]);
    }

    const descripcion =
      col.descripcion !== -1 ? String(row[col.descripcion] ?? "").trim() : "";

    // LP: preferimos la columna "IIB LP" (>0 = LP); si no está, el tag [LP].
    const esLP =
      col.iibLP !== -1 ? toNumber(row[col.iibLP]) > 0 : detectarLP(descripcion);

    items.push({
      sku,
      descripcion,
      marca: col.marca !== -1 ? String(row[col.marca] ?? "").trim() : "",
      esLP,
      ivaCoef:
        col.ivaCoef !== -1 && toNumber(row[col.ivaCoef]) > 0
          ? toNumber(row[col.ivaCoef])
          : 1.21,
      stock: col.stock !== -1 ? Math.trunc(toNumber(row[col.stock])) : 0,
      costoSinIVA: col.costoSinIVA !== -1 ? toNumber(row[col.costoSinIVA]) : 0,
      pesoAforado: col.pesoAforado !== -1 ? toNumber(row[col.pesoAforado]) : 0,
      stockValorizado:
        col.stockValorizado !== -1 ? toNumber(row[col.stockValorizado]) : 0,
      precios,
      fees,
    });
  }

  return { items, total: items.length, headerRow, columnas: { ...col, precioCols } };
}
