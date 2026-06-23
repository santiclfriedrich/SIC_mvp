// Parser del report21 (export crudo del ERP). Reemplaza el BUSCARX manual:
// recibe las filas del xlsx (header:1) y devuelve un mapa por SKU con los
// 4 campos base que enriquecen cada producto + descripción/marca/LP.

import { REPORT21_MAP, detectarLP } from "./stores.js";

// Normaliza un header: minúsculas, sin acentos, sin espacios de más.
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
  // tolera "1.234,56" y "1234.56"
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : Number(v) || 0;
}

/**
 * Localiza los índices de columna a partir de la fila de headers.
 * @param {string[]} headerRow
 * @returns {Record<string, number>}
 */
export function mapearColumnas(headerRow) {
  const headers = headerRow.map(norm);
  const idx = {};

  const buscar = (alias) => {
    for (const a of alias) {
      const i = headers.indexOf(norm(a));
      if (i !== -1) return i;
    }
    return -1;
  };

  idx.sku = buscar(REPORT21_MAP.sku);
  idx.costoSinIVA = buscar(REPORT21_MAP.costoSinIVA);
  idx.pesoAforado = buscar(REPORT21_MAP.pesoAforado);
  idx.stockValorizado = buscar(REPORT21_MAP.stockValorizado);
  idx.descripcion = buscar(REPORT21_MAP.descripcion);
  idx.marca = buscar(REPORT21_MAP.marca);
  idx.ivaCoef = buscar(REPORT21_MAP.ivaCoef);

  // stock: header tipo "stock 17/06" (prefijo), excluyendo "stock valorizado".
  const pref = norm(REPORT21_MAP.stockPrefijo);
  idx.stock = headers.findIndex(
    (h) => h.startsWith(pref) && !h.includes("valorizado")
  );

  return idx;
}

/**
 * Parsea las filas del report21.
 * @param {any[][]} rows  filas del xlsx (XLSX.utils.sheet_to_json con header:1)
 * @returns {{ porSku: Map<string, object>, columnas: object, total: number, headerRow: number }}
 */
export function parseReport21(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { porSku: new Map(), columnas: {}, total: 0, headerRow: -1 };
  }

  // Detecta la fila de headers: la que contenga "SKU".
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if ((rows[i] || []).some((c) => norm(c) === "sku")) {
      headerRow = i;
      break;
    }
  }
  if (headerRow === -1) {
    return { porSku: new Map(), columnas: {}, total: 0, headerRow: -1 };
  }

  const columnas = mapearColumnas(rows[headerRow]);
  if (columnas.sku === -1) {
    return { porSku: new Map(), columnas, total: 0, headerRow };
  }

  const porSku = new Map();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const sku = String(row[columnas.sku] ?? "").trim();
    if (!sku) continue;

    const descripcion =
      columnas.descripcion !== -1 ? String(row[columnas.descripcion] ?? "").trim() : "";

    porSku.set(sku, {
      sku,
      descripcion,
      marca: columnas.marca !== -1 ? String(row[columnas.marca] ?? "").trim() : "",
      esLP: detectarLP(descripcion),
      ivaCoef:
        columnas.ivaCoef !== -1 && toNumber(row[columnas.ivaCoef]) > 0
          ? toNumber(row[columnas.ivaCoef])
          : 1.21,
      costoSinIVA: columnas.costoSinIVA !== -1 ? toNumber(row[columnas.costoSinIVA]) : 0,
      pesoAforado: columnas.pesoAforado !== -1 ? toNumber(row[columnas.pesoAforado]) : 0,
      stock: columnas.stock !== -1 ? Math.trunc(toNumber(row[columnas.stock])) : 0,
      stockValorizado:
        columnas.stockValorizado !== -1 ? toNumber(row[columnas.stockValorizado]) : 0,
    });
  }

  return { porSku, columnas, total: porSku.size, headerRow };
}

/** Devuelve los datos base de un SKU concreto desde un report21 ya parseado. */
export function buscarSku(parsed, sku) {
  return parsed.porSku.get(String(sku).trim()) || null;
}
