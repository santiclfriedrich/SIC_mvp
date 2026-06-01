// Builder de la hoja "Resumen por Cliente" — equivalente a crearHojaResumen() del Apps Script.

import { VENDEDORES_EXCLUIDOS, UMBRAL_SALDO } from "./config";
import {
  COLORS,
  NF,
  cell,
  fmt,
  updateCellsReq,
  mergeReq,
  bordersReq,
  dimensionReq,
  freezeRowsReq,
  basicFilterReq,
} from "./sheets-helpers";

/**
 * Genera todos los requests para construir la hoja Resumen.
 * Asume que la hoja ya existe en el spreadsheet, con sheetId conocido.
 *
 * @param {number} sheetId - ID de la hoja
 * @param {Array} clientes - clientes filtrados/ordenados con vendedoresStr
 * @param {string} fuente - nombre del archivo original
 * @returns {Array} array de requests para batchUpdate
 */
export function buildResumen(sheetId, clientes, fuente) {
  const n = clientes.length;
  const totalRow1Based = 5 + n; // misma convención del Script (1-indexed)

  // ===== Filas a escribir =====
  const filas = [];

  // Fila 1: título
  filas.push([
    cell("CUENTAS CORRIENTES - REPORTE FILTRADO POR VENDEDOR", fmt({
      bg: COLORS.titulo,
      fg: COLORS.white,
      bold: true,
      fontSize: 14,
      halign: "CENTER",
      valign: "MIDDLE",
    })),
    cell(""), cell(""), cell(""), cell(""), cell(""),
  ]);

  // Fila 2: subtítulo
  const fecha = new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  let subt = `Generado: ${fecha}`;
  if (fuente) subt += `  —  Fuente: ${fuente}`;
  subt += `  —  Saldo > $${UMBRAL_SALDO}`;
  subt += `  —  Excluidos: ${VENDEDORES_EXCLUIDOS.join(" / ")}`;
  filas.push([
    cell(subt, fmt({ italic: true, fg: COLORS.grayText, fontSize: 9, valign: "MIDDLE" })),
    cell(""), cell(""), cell(""), cell(""), cell(""),
  ]);

  // Fila 3: espaciador
  filas.push([cell(""), cell(""), cell(""), cell(""), cell(""), cell("")]);

  // Fila 4: headers
  const headerFmt = fmt({
    bg: COLORS.header, fg: COLORS.white, bold: true,
    halign: "CENTER", valign: "MIDDLE",
  });
  filas.push([
    cell("N° Cliente", headerFmt),
    cell("Nombre Cliente", headerFmt),
    cell("Vendedor", headerFmt),
    cell("Cant. Comprob.", headerFmt),
    cell("Saldo Adeudado (ARS)", headerFmt),
    cell("% del Total", headerFmt),
  ]);

  // Filas de datos (5 a 5+n-1 en 1-indexed)
  for (let i = 0; i < n; i++) {
    const c = clientes[i];
    const altBg = i % 2 === 1 ? COLORS.alt : null;
    const rowBg = altBg ? { bg: altBg } : {};

    filas.push([
      cell(String(c.numero ?? ""), fmt({ ...rowBg, halign: "CENTER" })),
      cell(c.nombre ?? "", fmt(rowBg)),
      cell(c.vendedoresStr || "—", fmt(rowBg)),
      cell(c.comprobantes.length, fmt({ ...rowBg, halign: "CENTER" })),
      cell(c.saldo_total || 0, fmt({ ...rowBg, halign: "RIGHT", numberFormat: NF.monedaArs })),
      cell(`=E${5 + i}/$E$${totalRow1Based}`, fmt({ ...rowBg, halign: "RIGHT", numberFormat: NF.pct })),
    ]);
  }

  // Fila TOTAL
  const totalFmt = fmt({ bg: COLORS.total, bold: true, fontSize: 11 });
  filas.push([
    cell("TOTAL", fmt({ bg: COLORS.total, bold: true, fontSize: 11, halign: "CENTER" })),
    cell("", totalFmt),
    cell("", totalFmt),
    cell(`=SUM(D5:D${totalRow1Based - 1})`, fmt({ bg: COLORS.total, bold: true, fontSize: 11, halign: "CENTER" })),
    cell(`=SUM(E5:E${totalRow1Based - 1})`, fmt({ bg: COLORS.total, bold: true, fontSize: 11, halign: "RIGHT", numberFormat: NF.monedaArsSimple })),
    cell(`=SUM(F5:F${totalRow1Based - 1})`, fmt({ bg: COLORS.total, bold: true, fontSize: 11, halign: "RIGHT", numberFormat: NF.pct })),
  ]);

  // ===== Requests =====
  const reqs = [];

  // Valores + formato
  reqs.push(updateCellsReq(sheetId, 0, 0, filas));

  // Merges de título y subtítulo
  reqs.push(mergeReq(sheetId, 0, 1, 0, 6));   // A1:F1
  reqs.push(mergeReq(sheetId, 1, 2, 0, 6));   // A2:F2
  // Merge "TOTAL" sobre A:C (col 1-3)
  reqs.push(mergeReq(sheetId, totalRow1Based - 1, totalRow1Based, 0, 3));

  // Bordes alrededor del header + datos + total
  reqs.push(bordersReq(sheetId, 3, totalRow1Based, 0, 6));

  // Filter sobre header + datos
  if (n > 0) {
    reqs.push(basicFilterReq(sheetId, 3, totalRow1Based - 1, 0, 6));
  }

  // Anchos de columnas: [85, 280, 200, 95, 150, 85]
  const widths = [85, 280, 200, 95, 150, 85];
  widths.forEach((w, i) => {
    reqs.push(dimensionReq(sheetId, "COLUMNS", i, i + 1, w));
  });

  // Alturas de filas clave
  reqs.push(dimensionReq(sheetId, "ROWS", 0, 1, 32));  // título
  reqs.push(dimensionReq(sheetId, "ROWS", 1, 2, 20));  // subtítulo
  reqs.push(dimensionReq(sheetId, "ROWS", 3, 4, 26));  // header
  reqs.push(dimensionReq(sheetId, "ROWS", totalRow1Based - 1, totalRow1Based, 26)); // total

  // Freeze 4 filas superiores
  reqs.push(freezeRowsReq(sheetId, 4));

  return reqs;
}
