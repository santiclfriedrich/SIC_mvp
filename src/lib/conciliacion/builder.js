// Builders de las hojas del Sheet de conciliación. Reutiliza los helpers
// genéricos de reportes-cc (cell/fmt/requests).

import {
  COLORS,
  NF,
  cell,
  cellTexto,
  fmt,
  updateCellsReq,
  mergeReq,
  bordersReq,
  dimensionReq,
  freezeRowsReq,
} from "@/lib/reportes-cc/sheets-helpers";

export const HOJA_RESUMEN = "Resumen";
export const HOJA_COBRADAS = "Cobradas";
export const HOJA_PENDIENTES = "Pendientes";
export const HOJA_SOBRANTES = "MP sin GBP";

/**
 * Redimensiona la grilla de la hoja. Una hoja nueva viene con 1000 filas por
 * defecto; si escribimos más (updateCells con range) la API rechaza el request.
 */
function resizeGridReq(sheetId, rowCount, columnCount) {
  return {
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { rowCount, columnCount } },
      fields: "gridProperties.rowCount,gridProperties.columnCount",
    },
  };
}

const fechaGen = () =>
  new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/** Crea la CellData de una celda de dato según el tipo de columna. */
function celda(col, row, baseBg) {
  const bg = baseBg ? { bg: baseBg } : {};
  const val = col.get ? col.get(row) : row[col.key];

  if (col.tipo === "op") {
    return cellTexto(String(val ?? ""), fmt({ ...bg, valign: "MIDDLE" }));
  }
  if (col.tipo === "moneda") {
    const extra = col.red && col.red(row) ? { fg: COLORS.red, bold: true } : {};
    return cell(Number(val) || 0, fmt({ ...bg, ...extra, halign: "RIGHT", numberFormat: NF.monedaArs }));
  }
  if (col.tipo === "fecha") {
    return cell(val || "", fmt({ ...bg, halign: "CENTER", numberFormat: NF.fecha, numberFormatType: "DATE" }));
  }
  // texto
  return cell(val ?? "", fmt({ ...bg, valign: "MIDDLE" }));
}

/**
 * Construye una hoja tipo tabla: título + subtítulo + headers + filas.
 * @returns {Array} requests de batchUpdate
 */
export function buildTabla(sheetId, { titulo, subtitulo, columnas, filas }) {
  const nCols = columnas.length;
  const grid = [];

  const blank = (fmtObj) => Array.from({ length: nCols }, () => cell("", fmtObj));

  // Fila 1: título
  const tituloFmt = fmt({
    bg: COLORS.titulo, fg: COLORS.white, bold: true, fontSize: 14, halign: "CENTER", valign: "MIDDLE",
  });
  const filaTitulo = blank(tituloFmt);
  filaTitulo[0] = cell(titulo, tituloFmt);
  grid.push(filaTitulo);

  // Fila 2: subtítulo
  const subFmt = fmt({ italic: true, fg: COLORS.grayText, fontSize: 9, valign: "MIDDLE" });
  const filaSub = blank(subFmt);
  filaSub[0] = cell(subtitulo, subFmt);
  grid.push(filaSub);

  // Fila 3: espaciador
  grid.push(blank(fmt({})));

  // Fila 4: headers
  const headerFmt = fmt({ bg: COLORS.header, fg: COLORS.white, bold: true, halign: "CENTER", valign: "MIDDLE" });
  grid.push(columnas.map((c) => cell(c.header, headerFmt)));

  // Filas de datos (con alternancia de fondo)
  filas.forEach((row, i) => {
    const bg = i % 2 === 1 ? COLORS.alt : null;
    grid.push(columnas.map((c) => celda(c, row, bg)));
  });

  const totalRows = grid.length;
  const reqs = [];

  // Agrandar la grilla ANTES de escribir (evita el "beyond the last requested row").
  // +2 de colchón y mínimo 10 filas (para buckets vacíos, así el freeze de 4 filas es válido).
  reqs.push(resizeGridReq(sheetId, Math.max(totalRows + 2, 10), nCols));

  reqs.push(updateCellsReq(sheetId, 0, 0, grid));
  reqs.push(mergeReq(sheetId, 0, 1, 0, nCols)); // título A1:..
  reqs.push(mergeReq(sheetId, 1, 2, 0, nCols)); // subtítulo A2:..

  // Bordes de header + datos
  reqs.push(bordersReq(sheetId, 3, totalRows, 0, nCols));

  // Anchos
  columnas.forEach((c, i) => reqs.push(dimensionReq(sheetId, "COLUMNS", i, i + 1, c.width)));

  reqs.push(dimensionReq(sheetId, "ROWS", 0, 1, 32));
  reqs.push(freezeRowsReq(sheetId, 4));

  return reqs;
}

const COLS_COBRADAS = [
  { header: "N° Operación", width: 140, tipo: "op", key: "op" },
  { header: "Cliente", width: 260, tipo: "texto", get: (r) => r.cliente },
  { header: "Recibo", width: 160, tipo: "texto", get: (r) => r.recibo },
  { header: "Fecha", width: 95, tipo: "fecha", get: (r) => r.fecha },
  { header: "Importe GBP", width: 130, tipo: "moneda", get: (r) => r.importeGbp },
  { header: "Cuenta MP", width: 110, tipo: "texto", get: (r) => r.cuentaMp },
  { header: "Importe MP", width: 130, tipo: "moneda", get: (r) => r.importeMp },
  { header: "Diferencia", width: 120, tipo: "moneda", get: (r) => r.diferencia, red: (r) => Math.abs(r.diferencia) >= 1 },
];

const COLS_PENDIENTES = [
  { header: "N° Operación", width: 140, tipo: "op", key: "op" },
  { header: "Cliente", width: 300, tipo: "texto", get: (r) => r.cliente },
  { header: "Recibo", width: 160, tipo: "texto", get: (r) => r.recibo },
  { header: "Fecha", width: 95, tipo: "fecha", get: (r) => r.fecha },
  { header: "Importe GBP", width: 140, tipo: "moneda", get: (r) => r.importeGbp },
];

const COLS_SOBRANTES = [
  { header: "N° Operación", width: 140, tipo: "op", key: "op" },
  { header: "Cuenta MP", width: 110, tipo: "texto", get: (r) => r.cuentaMp },
  { header: "Fecha de Pago", width: 110, tipo: "fecha", get: (r) => r.fecha },
  { header: "Importe MP", width: 140, tipo: "moneda", get: (r) => r.importeMp },
  { header: "Tipo", width: 220, tipo: "texto", get: (r) => r.tipo },
  { header: "Concepto", width: 140, tipo: "texto", get: (r) => r.concepto },
];

export function buildCobradas(sheetId, filas) {
  return buildTabla(sheetId, {
    titulo: "COBRADAS — operaciones de GBP cobradas en MercadoPago",
    subtitulo: `Generado: ${fechaGen()}. ${filas.length} operaciones.`,
    columnas: COLS_COBRADAS,
    filas,
  });
}

export function buildPendientes(sheetId, filas) {
  return buildTabla(sheetId, {
    titulo: "PENDIENTES — operaciones de GBP sin cobro en MercadoPago",
    subtitulo: `Generado: ${fechaGen()}. ${filas.length} operaciones.`,
    columnas: COLS_PENDIENTES,
    filas,
  });
}

export function buildSobrantes(sheetId, filas) {
  return buildTabla(sheetId, {
    titulo: "MP SIN GBP — cobros en MercadoPago sin operación en el listado GBP",
    subtitulo: `Generado: ${fechaGen()}. ${filas.length} operaciones.`,
    columnas: COLS_SOBRANTES,
    filas,
  });
}

/** Hoja Resumen: KPIs del cruce. */
export function buildResumen(sheetId, totales, fuente) {
  const grid = [];
  const nCols = 2;

  const tituloFmt = fmt({ bg: COLORS.titulo, fg: COLORS.white, bold: true, fontSize: 14, halign: "CENTER", valign: "MIDDLE" });
  grid.push([cell("CONCILIACIÓN GBP ↔ MERCADOPAGO", tituloFmt), cell("", tituloFmt)]);

  const subFmt = fmt({ italic: true, fg: COLORS.grayText, fontSize: 9, valign: "MIDDLE" });
  grid.push([cell(`Fuente: ${fuente} · Generado: ${fechaGen()}`, subFmt), cell("", subFmt)]);
  grid.push([cell(""), cell("")]);

  const lblFmt = fmt({ bold: true, fg: COLORS.titulo, valign: "MIDDLE" });
  const numFmt = fmt({ halign: "RIGHT", numberFormat: NF.entero, valign: "MIDDLE" });
  const monFmt = fmt({ halign: "RIGHT", numberFormat: NF.monedaArs, valign: "MIDDLE" });

  const filaKV = (label, value, valFmt) => [cell(label, lblFmt), cell(value, valFmt)];

  grid.push(filaKV("Operaciones GBP (con N° operación)", totales.gbpOps, numFmt));
  grid.push(filaKV("  · GBP sin N° operación (ignoradas)", totales.gbpSinOp, numFmt));
  grid.push(filaKV("Operaciones MercadoPago (únicas)", totales.mpOps, numFmt));
  grid.push([cell(""), cell("")]);
  grid.push(filaKV("✅ Cobradas (GBP en MP)", totales.cobradas, numFmt));
  grid.push(filaKV("⏳ Pendientes (GBP sin MP)", totales.pendientes, numFmt));
  grid.push(filaKV("⚠️ MP sin GBP", totales.sobrantes, numFmt));
  grid.push([cell(""), cell("")]);
  grid.push(filaKV("Monto cobrado en MP", totales.montoCobrado, monFmt));
  grid.push(filaKV("Monto pendiente (GBP)", totales.montoPendiente, monFmt));
  grid.push(filaKV("Monto MP sin GBP", totales.montoSobrante, monFmt));

  const reqs = [];
  reqs.push(updateCellsReq(sheetId, 0, 0, grid));
  reqs.push(mergeReq(sheetId, 0, 1, 0, nCols));
  reqs.push(mergeReq(sheetId, 1, 2, 0, nCols));
  reqs.push(dimensionReq(sheetId, "COLUMNS", 0, 1, 320));
  reqs.push(dimensionReq(sheetId, "COLUMNS", 1, 2, 180));
  reqs.push(dimensionReq(sheetId, "ROWS", 0, 1, 32));
  reqs.push(freezeRowsReq(sheetId, 3));
  return reqs;
}
