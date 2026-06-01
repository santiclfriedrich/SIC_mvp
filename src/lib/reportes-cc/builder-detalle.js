// Builder de la hoja "Detalle Comprobantes" — equivalente a crearHojaDetalle().
// Cada cliente es un bloque con header bold + comprobantes agrupados (colapsables).

import { HOJA_RESUMEN } from "./config";
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
  addRowGroupReq,
} from "./sheets-helpers";

export function buildDetalle(sheetId, clientes) {
  const filas = [];
  const groupRanges = []; // {start, end} en 0-indexed para addDimensionGroup

  // ===== Filas 1-3: título + subtítulo + espaciador =====
  filas.push([
    cell("DETALLE DE COMPROBANTES POR CLIENTE", fmt({
      bg: COLORS.titulo, fg: COLORS.white, bold: true, fontSize: 14,
      halign: "CENTER", valign: "MIDDLE",
    })),
    cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""),
  ]);

  const fecha = new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  filas.push([
    cell(
      `Generado: ${fecha}. Usá los +/- a la izquierda para colapsar cada cliente.`,
      fmt({ italic: true, fg: COLORS.grayText, fontSize: 9, valign: "MIDDLE" })
    ),
    cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""),
  ]);

  filas.push([cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell("")]);

  // ===== Fila 4: headers =====
  const headerFmt = fmt({
    bg: COLORS.header, fg: COLORS.white, bold: true,
    halign: "CENTER", valign: "MIDDLE",
  });
  filas.push([
    cell("N° Cliente", headerFmt),
    cell("Cliente / Comprobante", headerFmt),
    cell("Vendedor", headerFmt),
    cell("Comprobante", headerFmt),
    cell("Fecha Emisión", headerFmt),
    cell("Fecha Vto.", headerFmt),
    cell("Total (ARS)", headerFmt),
    cell("Saldo Pendiente (ARS)", headerFmt),
  ]);

  // ===== Bloques por cliente =====
  let fila1Based = 5;

  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    const altBg = i % 2 === 1 ? COLORS.alt : null;

    // Fila header del cliente (azul claro, bold)
    const clienteFmt = fmt({
      bg: COLORS.cliente, fg: COLORS.titulo, bold: true,
    });
    filas.push([
      cell(String(c.numero ?? ""), fmt({ bg: COLORS.cliente, fg: COLORS.titulo, bold: true, halign: "CENTER" })),
      cell(`${c.nombre ?? ""}  (${c.comprobantes.length} comprob.)`, clienteFmt),
      cell(c.vendedoresStr || "—", clienteFmt),
      cell("", clienteFmt),
      cell("", clienteFmt),
      cell("", clienteFmt),
      cell("", clienteFmt),
      // El subtotal va con fórmula apuntando a los comprobantes que siguen
      cell(
        c.comprobantes.length > 0
          ? `=SUM(H${fila1Based + 1}:H${fila1Based + c.comprobantes.length})`
          : 0,
        fmt({ bg: COLORS.cliente, fg: COLORS.titulo, bold: true, halign: "RIGHT", numberFormat: NF.monedaArsSimple })
      ),
    ]);
    const headerRowIdx0 = fila1Based - 1; // 0-indexed
    fila1Based++;

    const grupoIni0 = fila1Based - 1; // 0-indexed primera fila del grupo
    for (let j = 0; j < c.comprobantes.length; j++) {
      const cp = c.comprobantes[j];
      const rowBg = altBg ? { bg: altBg } : {};
      filas.push([
        cell("", fmt(rowBg)),
        cell("", fmt(rowBg)),
        cell(cp.vendedor || "—", fmt(rowBg)),
        cell(cp.comprobante, fmt(rowBg)),
        cell(cp.fecha, fmt({ ...rowBg, halign: "CENTER", numberFormat: NF.fecha, numberFormatType: "DATE" })),
        cell(cp.fecha_pago, fmt({ ...rowBg, halign: "CENTER", numberFormat: NF.fecha, numberFormatType: "DATE" })),
        cell(cp.total, fmt({ ...rowBg, halign: "RIGHT", numberFormat: NF.monedaArs })),
        cell(cp.saldo, fmt({ ...rowBg, halign: "RIGHT", numberFormat: NF.monedaArs })),
      ]);
      fila1Based++;
    }
    const grupoFin0 = fila1Based - 1; // 0-indexed exclusive (apunta a la fila después)
    if (grupoFin0 > grupoIni0) {
      groupRanges.push({ start: grupoIni0, end: grupoFin0 });
    }
  }

  // ===== Fila TOTAL GENERAL =====
  const totalRowIdx0 = fila1Based - 1; // 0-indexed
  const totalFmt = fmt({ bg: COLORS.total, bold: true, fontSize: 11 });
  filas.push([
    cell("TOTAL GENERAL DEUDA", fmt({ bg: COLORS.total, bold: true, fontSize: 11, halign: "RIGHT" })),
    cell("", totalFmt),
    cell("", totalFmt),
    cell("", totalFmt),
    cell("", totalFmt),
    cell("", totalFmt),
    cell("", totalFmt),
    cell(
      `='${HOJA_RESUMEN}'!E${5 + clientes.length}`,
      fmt({ bg: COLORS.total, bold: true, fontSize: 11, halign: "RIGHT", numberFormat: NF.monedaArsSimple })
    ),
  ]);

  // ===== Requests =====
  const reqs = [];

  reqs.push(updateCellsReq(sheetId, 0, 0, filas));

  reqs.push(mergeReq(sheetId, 0, 1, 0, 8));  // A1:H1
  reqs.push(mergeReq(sheetId, 1, 2, 0, 8));  // A2:H2
  reqs.push(mergeReq(sheetId, totalRowIdx0, totalRowIdx0 + 1, 0, 7)); // TOTAL row A:G

  // Bordes alrededor de header + datos + total
  reqs.push(bordersReq(sheetId, 3, totalRowIdx0 + 1, 0, 8));

  // Anchos de columnas: [85, 300, 170, 170, 100, 100, 140, 150]
  const widths = [85, 300, 170, 170, 100, 100, 140, 150];
  widths.forEach((w, i) => {
    reqs.push(dimensionReq(sheetId, "COLUMNS", i, i + 1, w));
  });

  reqs.push(dimensionReq(sheetId, "ROWS", 0, 1, 32));
  reqs.push(dimensionReq(sheetId, "ROWS", 1, 2, 20));
  reqs.push(dimensionReq(sheetId, "ROWS", 3, 4, 26));
  reqs.push(dimensionReq(sheetId, "ROWS", totalRowIdx0, totalRowIdx0 + 1, 28));

  reqs.push(freezeRowsReq(sheetId, 4));

  // Row groups (uno por cliente)
  groupRanges.forEach((g) => {
    reqs.push(addRowGroupReq(sheetId, g.start, g.end));
  });

  return reqs;
}
