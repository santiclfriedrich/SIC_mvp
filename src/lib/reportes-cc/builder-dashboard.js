// Builder de la hoja "Dashboard" — equivalente a crearHojaDashboard().
// KPIs en filas 4-6, datos auxiliares en columnas J-K, 2 gráficos.

import {
  COLORS,
  NF,
  cell,
  fmt,
  updateCellsReq,
  mergeReq,
  bordersReq,
  dimensionReq,
} from "./sheets-helpers";

export function buildDashboard(sheetId, clientes, totales, porVendedor, fuente) {
  const reqs = [];

  // ===== Fila 1: título =====
  const titulo = [[
    cell("DASHBOARD - CUENTAS CORRIENTES", fmt({
      bg: COLORS.titulo, fg: COLORS.white, bold: true, fontSize: 16,
      halign: "CENTER", valign: "MIDDLE",
    })),
    cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""),
  ]];
  reqs.push(updateCellsReq(sheetId, 0, 0, titulo));
  reqs.push(mergeReq(sheetId, 0, 1, 0, 8));
  reqs.push(dimensionReq(sheetId, "ROWS", 0, 1, 38));

  // ===== Fila 2: subtítulo =====
  const fecha = new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  let subt = `Generado: ${fecha}`;
  if (fuente) subt += `  —  Fuente: ${fuente}`;
  reqs.push(updateCellsReq(sheetId, 1, 0, [[
    cell(subt, fmt({
      italic: true, fg: COLORS.grayText, fontSize: 9,
      halign: "CENTER", valign: "MIDDLE",
    })),
    cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""),
  ]]));
  reqs.push(mergeReq(sheetId, 1, 2, 0, 8));
  reqs.push(dimensionReq(sheetId, "ROWS", 1, 2, 22));

  // ===== KPIs (filas 4-6 en 1-indexed → 3-5 en 0-indexed) =====
  const kpis = [
    { label: "TOTAL DEUDA",          value: totales.totalDeuda,    format: NF.monedaArsEntera, color: COLORS.red },
    { label: "CLIENTES",             value: totales.totalClientes, format: NF.entero,          color: COLORS.titulo },
    { label: "COMPROBANTES",         value: totales.totalComp,     format: NF.entero,          color: COLORS.titulo },
    { label: "PROMEDIO POR CLIENTE", value: totales.promedio,      format: NF.monedaArsEntera, color: COLORS.green },
  ];

  const kpiHeaderFmt = fmt({
    bg: COLORS.kpiBg, fg: COLORS.grayText, bold: true, fontSize: 10,
    halign: "CENTER", valign: "MIDDLE",
  });
  // Fila 3 (0-indexed): labels de los 4 KPIs ocupando 2 cols cada uno
  const kpiLabelRow = [];
  for (let i = 0; i < 4; i++) {
    kpiLabelRow.push(cell(kpis[i].label, kpiHeaderFmt));
    kpiLabelRow.push(cell("", kpiHeaderFmt));
  }
  reqs.push(updateCellsReq(sheetId, 3, 0, [kpiLabelRow]));
  // Merges A4:B4, C4:D4, E4:F4, G4:H4
  for (let i = 0; i < 4; i++) {
    reqs.push(mergeReq(sheetId, 3, 4, i * 2, i * 2 + 2));
  }
  reqs.push(dimensionReq(sheetId, "ROWS", 3, 4, 26));

  // Filas 5-6 (0-indexed 4-5): valores
  const kpiValRow1 = [];
  const kpiValRow2 = [];
  for (let i = 0; i < 4; i++) {
    const valFmt = fmt({
      bg: COLORS.white, fg: kpis[i].color, bold: true, fontSize: 20,
      halign: "CENTER", valign: "MIDDLE",
      numberFormat: kpis[i].format,
    });
    kpiValRow1.push(cell(kpis[i].value, valFmt));
    kpiValRow1.push(cell("", valFmt));
    kpiValRow2.push(cell("", valFmt));
    kpiValRow2.push(cell("", valFmt));
  }
  reqs.push(updateCellsReq(sheetId, 4, 0, [kpiValRow1, kpiValRow2]));
  // Merges A5:B6, C5:D6, etc.
  for (let i = 0; i < 4; i++) {
    reqs.push(mergeReq(sheetId, 4, 6, i * 2, i * 2 + 2));
  }
  reqs.push(dimensionReq(sheetId, "ROWS", 4, 5, 30));
  reqs.push(dimensionReq(sheetId, "ROWS", 5, 6, 30));

  reqs.push(bordersReq(sheetId, 3, 6, 0, 8));

  // ===== Datos auxiliares en columnas J-K (índices 9-10) =====

  // Headers Top 10 (fila 9 = 0-indexed 8)
  const auxHeaderFmt = fmt({
    bg: COLORS.header, fg: COLORS.white, bold: true,
    halign: "CENTER",
  });
  reqs.push(updateCellsReq(sheetId, 8, 9, [[
    cell("Cliente", auxHeaderFmt),
    cell("Saldo (ARS)", auxHeaderFmt),
  ]]));

  // Top 10 datos (filas 10-19 = 0-indexed 9-18)
  const top10 = clientes.slice(0, 10);
  if (top10.length > 0) {
    const top10Rows = top10.map((c) => [
      cell(c.nombre || "—"),
      cell(c.saldo_total || 0, fmt({ halign: "RIGHT", numberFormat: NF.monedaArsEntera })),
    ]);
    reqs.push(updateCellsReq(sheetId, 9, 9, top10Rows));
    reqs.push(bordersReq(sheetId, 8, 9 + top10.length, 9, 11));
  }

  // Por vendedor (filas 22+ = 0-indexed 21+)
  const vendStartIdx0 = 21;
  reqs.push(updateCellsReq(sheetId, vendStartIdx0, 9, [[
    cell("Vendedor", auxHeaderFmt),
    cell("Saldo (ARS)", auxHeaderFmt),
  ]]));

  if (porVendedor.length > 0) {
    const vendRows = porVendedor.map((v) => [
      cell(v.vendedor),
      cell(v.saldo, fmt({ halign: "RIGHT", numberFormat: NF.monedaArsEntera })),
    ]);
    reqs.push(updateCellsReq(sheetId, vendStartIdx0 + 1, 9, vendRows));
    reqs.push(bordersReq(sheetId, vendStartIdx0, vendStartIdx0 + 1 + porVendedor.length, 9, 11));
  }

  // ===== Panel headers (TOP 10 / DEUDA POR VENDEDOR) =====
  const panelFmt = fmt({
    bg: COLORS.panelHeader, fg: COLORS.titulo, bold: true, fontSize: 12,
    halign: "CENTER", valign: "MIDDLE",
  });
  reqs.push(updateCellsReq(sheetId, 7, 0, [[
    cell("TOP 10 DEUDORES", panelFmt),
    cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""),
  ]]));
  reqs.push(mergeReq(sheetId, 7, 8, 0, 8));
  reqs.push(dimensionReq(sheetId, "ROWS", 7, 8, 26));

  reqs.push(updateCellsReq(sheetId, 27, 0, [[
    cell("DEUDA POR VENDEDOR", panelFmt),
    cell(""), cell(""), cell(""), cell(""), cell(""), cell(""), cell(""),
  ]]));
  reqs.push(mergeReq(sheetId, 27, 28, 0, 8));
  reqs.push(dimensionReq(sheetId, "ROWS", 27, 28, 26));

  // Filas de espacio
  reqs.push(dimensionReq(sheetId, "ROWS", 8, 27, 22));
  reqs.push(dimensionReq(sheetId, "ROWS", 28, 47, 22));

  // ===== Anchos de columnas =====
  for (let c = 0; c < 8; c++) {
    reqs.push(dimensionReq(sheetId, "COLUMNS", c, c + 1, 95));
  }
  reqs.push(dimensionReq(sheetId, "COLUMNS", 8, 9, 20));   // separador
  reqs.push(dimensionReq(sheetId, "COLUMNS", 9, 10, 240)); // nombre
  reqs.push(dimensionReq(sheetId, "COLUMNS", 10, 11, 140)); // saldo

  // ===== Gráficos =====
  // Chart 1: Top 10 deudores (bar horizontal)
  if (top10.length > 0) {
    reqs.push({
      addChart: {
        chart: {
          spec: {
            title: "Top 10 Deudores",
            basicChart: {
              chartType: "BAR",
              legendPosition: "NO_LEGEND",
              axis: [
                { position: "BOTTOM_AXIS", format: { } },
                { position: "LEFT_AXIS" },
              ],
              domains: [{
                domain: {
                  sourceRange: { sources: [{
                    sheetId, startRowIndex: 8, endRowIndex: 9 + top10.length,
                    startColumnIndex: 9, endColumnIndex: 10,
                  }] },
                },
              }],
              series: [{
                series: {
                  sourceRange: { sources: [{
                    sheetId, startRowIndex: 8, endRowIndex: 9 + top10.length,
                    startColumnIndex: 10, endColumnIndex: 11,
                  }] },
                },
                color: COLORS.header,
              }],
              headerCount: 1,
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 8, columnIndex: 0 },
              widthPixels: 780,
              heightPixels: 360,
            },
          },
        },
      },
    });
  }

  // Chart 2: Deuda por vendedor (donut)
  if (porVendedor.length > 0) {
    reqs.push({
      addChart: {
        chart: {
          spec: {
            title: "Deuda por Vendedor",
            pieChart: {
              legendPosition: "RIGHT_LEGEND",
              pieHole: 0.4,
              domain: {
                sourceRange: { sources: [{
                  sheetId,
                  startRowIndex: vendStartIdx0,
                  endRowIndex: vendStartIdx0 + 1 + porVendedor.length,
                  startColumnIndex: 9, endColumnIndex: 10,
                }] },
              },
              series: {
                sourceRange: { sources: [{
                  sheetId,
                  startRowIndex: vendStartIdx0,
                  endRowIndex: vendStartIdx0 + 1 + porVendedor.length,
                  startColumnIndex: 10, endColumnIndex: 11,
                }] },
              },
            },
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 28, columnIndex: 0 },
              widthPixels: 780,
              heightPixels: 400,
            },
          },
        },
      },
    });
  }

  return reqs;
}
