// Planilla VIVA: una sola copia persistente del molde donde la web escribe los
// precios al instante (las % se recalculan con las fórmulas originales).
// Server-only (usa el cliente de Google + Prisma).

import { prisma } from "@/lib/prisma";
import { PLANILLA_COLS, PLANILLA_MAP } from "./stores.js";
import { computeProduct } from "./engine.js";
import { getPricingConfig } from "./config.js";
import {
  copiarComoSheet,
  compartirConLink,
  listarSheets,
  leerRango,
  leerRangos,
  valoresBatchUpdate,
  copiarFila,
  batchUpdate,
  escribirValores,
  limpiarValores,
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

const _num = (v) => (v == null ? 0 : Number(v));

/** Construye los valores a escribir en la fila de un SKU (sku + base + precios + fee). */
function filaData(cols, titulo, fila, computed) {
  const data = [];
  const set = (letra, v) => {
    if (letra) data.push({ range: `${sheetRef(titulo)}!${letra}${fila}`, values: [[v]] });
  };
  set(cols._skuCol, computed.sku);
  set(cols.descripcion, computed.descripcion || "");
  set(cols.costo, computed.costoSinIVA);
  set(cols.peso, computed.pesoAforado);
  set(cols.stock, computed.stock != null ? computed.stock : 0);
  // stock valorizado = stock × costo s/IVA (en la planilla es un valor, no fórmula).
  set(cols.stockVal, (Number(computed.stock) || 0) * (Number(computed.costoSinIVA) || 0));
  set(cols.iva, _num(computed.ivaCoef) > 0 ? computed.ivaCoef : 1.21);
  set(cols.iibLP, computed.esLP ? 0.055 : 0);
  set(cols.ingresosBrutos, computed.esLP ? 0 : 0.055);
  for (const t of computed.tiendas || []) {
    set(cols[`${t.storeKey}-1pago`], t.precio1Pago != null ? t.precio1Pago : "");
    if (cols[`${t.storeKey}-3csi`]) set(cols[`${t.storeKey}-3csi`], t.precio3CSI != null ? t.precio3CSI : "");
    if (cols[`fee-${t.storeKey}`] && t.precio1Pago != null && t.fee1Pago != null) set(cols[`fee-${t.storeKey}`], t.fee1Pago);
  }
  return data;
}

/** PricingProduct (Prisma) → objeto con `.tiendas` calculado (sin pasar por server.js). */
function computedDeProducto(p, config) {
  const plain = {
    sku: p.sku,
    descripcion: p.descripcion || "",
    esLP: !!p.esLP,
    ivaCoef: _num(p.ivaCoef) > 0 ? _num(p.ivaCoef) : 1.21,
    costoSinIVA: _num(p.costoSinIVA),
    pesoAforado: _num(p.pesoAforado),
    stock: p.stock ?? 0,
    precios: p.preciosJson || {},
    precios3: p.precios3Json || {},
    fees: p.feesJson || {},
  };
  return { ...plain, tiendas: computeProduct(plain, config) };
}

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

  // Columnas base + fee (para escribir el fee y para agregar SKUs nuevos).
  const baseMap = {
    costo: PLANILLA_MAP.costoSinIVA,
    peso: PLANILLA_MAP.pesoAforado,
    iva: PLANILLA_MAP.ivaCoef,
    descripcion: PLANILLA_MAP.descripcion,
    stock: PLANILLA_MAP.stock,
    stockVal: PLANILLA_MAP.stockValorizado,
  };
  for (const [k, alias] of Object.entries(baseMap)) {
    const i = find(alias);
    if (i !== -1) cols[k] = colLetter(i);
  }
  for (const [storeKey, alias] of Object.entries(PLANILLA_MAP.feeCols)) {
    const i = find(alias);
    if (i !== -1) cols[`fee-${storeKey}`] = colLetter(i);
  }

  const skuCol = headers.indexOf("sku");
  const skuColLetter = colLetter(skuCol);
  const dataStart = hr + 2;

  // Info para agregar filas nuevas (fase 4): gid de la hoja, col SKU, fila plantilla.
  cols._mainGid = sheets[titulo];
  cols._skuCol = skuColLetter;
  cols._templateRow = dataStart;
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

  // --- Empuja TODOS los precios actuales de la web a la planilla nueva, así
  // queda 100% consistente (pisa los del molde y agrega los SKUs que no estaban). ---
  const config = await getPricingConfig();
  const productos = await prisma.pricingProduct.findMany();
  let nextRow = Object.keys(skuRowMap).length ? Math.max(...Object.values(skuRowMap)) : dataStart;
  let agregados = 0;
  const pushData = [];
  for (const p of productos) {
    const computed = computedDeProducto(p, config);
    let fila = skuRowMap[p.sku];
    if (!fila) {
      nextRow += 1;
      fila = nextRow;
      await copiarFila(spreadsheetId, cols._mainGid, dataStart, fila);
      skuRowMap[p.sku] = fila;
      agregados++;
    }
    pushData.push(...filaData(cols, titulo, fila, computed));
  }
  for (let i = 0; i < pushData.length; i += 400) {
    await valoresBatchUpdate(spreadsheetId, pushData.slice(i, i + 400));
  }

  await prisma.report21Upload.update({
    where: { id: 1 },
    data: {
      livePlanillaId: spreadsheetId,
      livePlanillaTitulo: titulo,
      planillaColsJson: cols,
      skuRowMapJson: skuRowMap,
    },
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    titulo,
    skus: Object.keys(skuRowMap).length,
    productosPusheados: productos.length,
    agregados,
  };
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
  const fila = (meta.skuRowMapJson || {})[productoComputed.sku];
  if (!fila) return { ok: false, motivo: "SKU no está en la planilla" };

  const data = filaData(cols, meta.livePlanillaTitulo, fila, productoComputed);
  if (data.length === 0) return { ok: false, motivo: "sin columnas" };
  await valoresBatchUpdate(meta.livePlanillaId, data);
  return { ok: true, celdas: data.length };
}

/**
 * Fase 4 — agrega la fila de un SKU nuevo a la planilla viva: copia una fila
 * plantilla (fórmulas + formato) y sobreescribe SKU + base + fee + precios como
 * valores. Actualiza el mapa SKU→fila.
 *
 * NOTA: las filas se agregan SIEMPRE al final (max+1) y NUNCA se borran filas
 * (no usar deleteDimension: correría los números de fila y desincronizaría el
 * mapa). Si la escritura falla, propaga el error y deja la fila copiada (que se
 * pisará en el próximo intento); el SKU no queda en el mapa.
 */
export async function agregarFilaEnViva(meta, computed) {
  const cols = meta.planillaColsJson || {};
  const gid = cols._mainGid;
  const tpl = cols._templateRow;
  if (gid == null || !tpl || !cols._skuCol) return { ok: false, motivo: "molde sin info para agregar filas" };

  const skuRowMap = { ...(meta.skuRowMapJson || {}) };
  const valores = Object.values(skuRowMap);
  const newRow = (valores.length ? Math.max(...valores) : tpl) + 1;

  await copiarFila(meta.livePlanillaId, gid, tpl, newRow);
  const data = filaData(cols, meta.livePlanillaTitulo, newRow, computed);
  await valoresBatchUpdate(meta.livePlanillaId, data);

  skuRowMap[computed.sku] = newRow;
  await prisma.report21Upload.update({ where: { id: 1 }, data: { skuRowMapJson: skuRowMap } });

  return { ok: true, fila: newRow, agregado: true };
}

/**
 * Sincroniza la fila de un SKU en la planilla viva: la escribe si ya tiene fila,
 * o la agrega (fase 4) si es nueva. Best-effort.
 */
export async function sincronizarFila(computed) {
  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  if (!meta?.livePlanillaId) return { ok: false, motivo: "sin planilla viva" };
  const row = (meta.skuRowMapJson || {})[computed.sku];
  if (row) return escribirFilaEnViva(meta, computed);
  return agregarFilaEnViva(meta, computed);
}

/**
 * Borrar SKU: ELIMINA la fila física de la planilla viva y reajusta el mapa
 * (toda fila por debajo de la borrada baja 1). Saca el SKU del mapa. Best-effort.
 *
 * El reajuste es lo que hace seguro borrar la fila: `deleteDimension` corre las
 * filas de abajo hacia arriba, así que descontamos 1 a cada entrada con row > fila.
 */
export async function limpiarFilaEnViva(sku) {
  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  if (!meta?.livePlanillaId) return { ok: false, motivo: "sin planilla viva" };
  const skuRowMap = { ...(meta.skuRowMapJson || {}) };
  const fila = skuRowMap[sku];
  if (!fila) return { ok: false, motivo: "SKU no está en la planilla" };

  const cols = meta.planillaColsJson || {};
  const gid = cols._mainGid;
  if (gid == null) return { ok: false, motivo: "molde sin gid" };

  // Borra la fila física.
  await batchUpdate(meta.livePlanillaId, [
    { deleteDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: fila - 1, endIndex: fila } } },
  ]);

  // Reajusta el mapa: saca el SKU y baja 1 a las filas por debajo.
  const nuevoMapa = {};
  for (const [s, r] of Object.entries(skuRowMap)) {
    if (s === sku) continue;
    nuevoMapa[s] = r > fila ? r - 1 : r;
  }
  await prisma.report21Upload.update({ where: { id: 1 }, data: { skuRowMapJson: nuevoMapa } });
  return { ok: true, fila };
}

/**
 * Reemplaza el contenido de la pestaña "report21" de la planilla viva con la
 * matriz nueva (borra todo lo anterior y pega lo nuevo). `rowsMatrix` es un
 * array de filas (la hoja report21 del archivo subido, header incluido).
 * Best-effort; escribe en chunks (RAW para no interpretar "=" ni reformatear).
 */
export async function reemplazarReport21EnViva(rowsMatrix) {
  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  if (!meta?.livePlanillaId) return { ok: false, motivo: "sin planilla viva" };
  if (!Array.isArray(rowsMatrix) || rowsMatrix.length === 0) {
    return { ok: false, motivo: "sin datos report21" };
  }

  const sheets = await listarSheets(meta.livePlanillaId);
  const titulo = Object.keys(sheets).find((t) => /report\s*21/i.test(t));
  if (!titulo) return { ok: false, motivo: "la planilla viva no tiene hoja report21" };
  const ref = sheetRef(titulo);

  // 1) borra todo el contenido anterior de la hoja.
  await limpiarValores(meta.livePlanillaId, ref);

  // 2) pega la matriz nueva en chunks de filas.
  const CHUNK = 2000;
  for (let i = 0; i < rowsMatrix.length; i += CHUNK) {
    const chunk = rowsMatrix.slice(i, i + CHUNK);
    await escribirValores(meta.livePlanillaId, `${ref}!A${i + 1}`, chunk, "RAW");
  }
  return { ok: true, hoja: titulo, filas: rowsMatrix.length };
}

/**
 * Empuja TODOS los PricingProduct a la planilla viva (escribe los que tienen
 * fila, agrega los que no). Se usa tras subir el report21 para reflejar
 * costo/stock/IVA actualizados. Best-effort; batch chunked.
 */
export async function empujarTodosEnViva(config) {
  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  if (!meta?.livePlanillaId) return { ok: false, motivo: "sin planilla viva" };

  const cols = meta.planillaColsJson || {};
  const titulo = meta.livePlanillaTitulo;
  const gid = cols._mainGid;
  const tpl = cols._templateRow;
  const skuRowMap = { ...(meta.skuRowMapJson || {}) };
  let nextRow = Object.keys(skuRowMap).length ? Math.max(...Object.values(skuRowMap)) : tpl;

  const productos = await prisma.pricingProduct.findMany();
  const data = [];
  let agregados = 0;
  for (const p of productos) {
    const computed = computedDeProducto(p, config);
    let fila = skuRowMap[p.sku];
    if (!fila) {
      nextRow += 1;
      fila = nextRow;
      await copiarFila(meta.livePlanillaId, gid, tpl, fila);
      skuRowMap[p.sku] = fila;
      agregados++;
    }
    data.push(...filaData(cols, titulo, fila, computed));
  }
  for (let i = 0; i < data.length; i += 400) {
    await valoresBatchUpdate(meta.livePlanillaId, data.slice(i, i + 400));
  }
  await prisma.report21Upload.update({ where: { id: 1 }, data: { skuRowMapJson: skuRowMap } });
  return { ok: true, escritos: productos.length, agregados };
}

const r2 = (n) => Math.round(Number(n) || 0); // redondeo a entero para comparar precios

/**
 * Fase 3 — planilla → web: lee los precios/LP de la planilla viva y actualiza en
 * la DB los PricingProduct existentes que difieran (refleja ediciones hechas en
 * el Sheet). No crea SKUs nuevos (eso es fase 4).
 * @returns {{ ok:boolean, actualizados:number, motivo?:string }}
 */
export async function sincronizarDesdeViva(config) {
  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  if (!meta?.livePlanillaId) return { ok: false, actualizados: 0, motivo: "sin planilla viva" };

  const cols = meta.planillaColsJson || {};
  const titulo = meta.livePlanillaTitulo;
  const skuRowMap = meta.skuRowMapJson || {};
  const rows = Object.values(skuRowMap);
  if (rows.length === 0) return { ok: false, actualizados: 0, motivo: "mapa vacío" };

  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const rowToSku = {};
  for (const [sku, r] of Object.entries(skuRowMap)) rowToSku[r] = sku;

  // Columnas a leer: precios por tienda/pago + IIB LP (para el LP).
  const activos = Object.values(config.stores).filter((s) => s.activo);
  const lectura = []; // { colKey, range }
  for (const s of activos) {
    for (const pago of ["1pago", "3csi"]) {
      const letra = cols[`${s.key}-${pago}`];
      if (letra) lectura.push({ colKey: `${s.key}-${pago}`, range: `${sheetRef(titulo)}!${letra}${minRow}:${letra}${maxRow}` });
    }
  }
  if (cols.iibLP) lectura.push({ colKey: "iibLP", range: `${sheetRef(titulo)}!${cols.iibLP}${minRow}:${cols.iibLP}${maxRow}` });

  const valueRanges = await leerRangos(meta.livePlanillaId, lectura.map((l) => l.range));
  // colKey → columna de valores (array por fila relativa)
  const colVals = {};
  lectura.forEach((l, i) => { colVals[l.colKey] = valueRanges[i]?.values || []; });
  const valEn = (colKey, row) => {
    const arr = colVals[colKey];
    const v = arr?.[row - minRow]?.[0];
    return v === "" || v == null ? null : Number(v);
  };

  const existentes = await prisma.pricingProduct.findMany();
  const porSku = new Map(existentes.map((p) => [p.sku, p]));

  let actualizados = 0;
  for (let row = minRow; row <= maxRow; row++) {
    const sku = rowToSku[row];
    if (!sku) continue;
    const prod = porSku.get(sku);
    if (!prod) continue; // sólo SKUs ya priceados (no creamos nuevos en fase 3)

    const precios = {};
    const precios3 = {};
    for (const s of activos) {
      const p1 = valEn(`${s.key}-1pago`, row);
      if (p1 != null && p1 > 0) precios[s.key] = p1;
      if (s.pagos["3csi"] && s.coefCSI) {
        const p3 = valEn(`${s.key}-3csi`, row);
        if (p3 != null && p3 > 0) {
          const derivado = (precios[s.key] || 0) * s.coefCSI;
          // Si el 3CSI difiere del derivado (más de $1) lo tomamos como override.
          if (Math.abs(p3 - derivado) > 1) precios3[s.key] = p3;
        }
      }
    }
    const lpVal = valEn("iibLP", row);
    const esLP = lpVal != null ? lpVal > 0.0001 : prod.esLP;

    // ¿Cambió algo respecto a la DB?
    const curP = prod.preciosJson || {};
    const curP3 = prod.precios3Json || {};
    const samePrecios = (a, b) => {
      const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of ks) if (r2(a[k]) !== r2(b[k])) return false;
      return true;
    };
    const cambio = !samePrecios(curP, precios) || !samePrecios(curP3, precios3) || !!prod.esLP !== !!esLP;
    if (!cambio) continue;

    await prisma.pricingProduct.update({
      where: { sku },
      data: { preciosJson: precios, precios3Json: precios3, esLP },
    });
    actualizados++;
  }

  return { ok: true, actualizados };
}
