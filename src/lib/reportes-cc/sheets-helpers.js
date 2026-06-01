// Helpers compartidos para armar requests de batchUpdate de Sheets API.

import {
  COLOR_TITULO,
  COLOR_HEADER,
  COLOR_TOTAL,
  COLOR_CLIENTE,
  COLOR_ALT,
  COLOR_BORDE,
} from "./config";

/** Convierte "#RRGGBB" a {red, green, blue} (0..1) para la API de Sheets. */
export function hex(color) {
  const c = color.replace("#", "");
  return {
    red: parseInt(c.substring(0, 2), 16) / 255,
    green: parseInt(c.substring(2, 4), 16) / 255,
    blue: parseInt(c.substring(4, 6), 16) / 255,
  };
}

export const COLORS = {
  titulo: hex(COLOR_TITULO),
  header: hex(COLOR_HEADER),
  total: hex(COLOR_TOTAL),
  cliente: hex(COLOR_CLIENTE),
  alt: hex(COLOR_ALT),
  borde: hex(COLOR_BORDE),
  white: hex("#FFFFFF"),
  black: hex("#000000"),
  grayText: hex("#595959"),
  red: hex("#C00000"),
  green: hex("#385723"),
  kpiBg: hex("#F2F2F2"),
  panelHeader: hex("#DDEBF7"),
};

/** Convierte un valor JS a CellData de Sheets API. */
export function cell(value, format) {
  const cd = { userEnteredFormat: format || {} };
  if (value === null || value === undefined || value === "") {
    cd.userEnteredValue = { stringValue: "" };
  } else if (value instanceof Date) {
    // Excel serial date (days since 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30);
    const days = (value.getTime() - epoch) / 86400000;
    cd.userEnteredValue = { numberValue: days };
  } else if (typeof value === "number") {
    cd.userEnteredValue = { numberValue: value };
  } else if (typeof value === "string" && value.charAt(0) === "=") {
    cd.userEnteredValue = { formulaValue: value };
  } else {
    cd.userEnteredValue = { stringValue: String(value) };
  }
  return cd;
}

/** Formato de celda con bg, color de texto, bold, alineación, etc. */
export function fmt(opts = {}) {
  const f = {};
  if (opts.bg) f.backgroundColor = opts.bg;
  if (opts.fg || opts.bold || opts.italic || opts.fontSize) {
    f.textFormat = {};
    if (opts.fg) f.textFormat.foregroundColor = opts.fg;
    if (opts.bold) f.textFormat.bold = true;
    if (opts.italic) f.textFormat.italic = true;
    if (opts.fontSize) f.textFormat.fontSize = opts.fontSize;
  }
  if (opts.halign) f.horizontalAlignment = opts.halign;
  if (opts.valign) f.verticalAlignment = opts.valign;
  if (opts.numberFormat) {
    f.numberFormat = { type: opts.numberFormatType || "NUMBER", pattern: opts.numberFormat };
  }
  return f;
}

/** Request: pone valores+formato en un rango. */
export function updateCellsReq(sheetId, startRow, startCol, rows) {
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: startRow,
        endRowIndex: startRow + rows.length,
        startColumnIndex: startCol,
        endColumnIndex: startCol + (rows[0]?.length || 0),
      },
      rows: rows.map((r) => ({ values: r })),
      fields: "userEnteredValue,userEnteredFormat",
    },
  };
}

/** Merge de celdas. */
export function mergeReq(sheetId, startRow, endRow, startCol, endCol) {
  return {
    mergeCells: {
      range: {
        sheetId,
        startRowIndex: startRow,
        endRowIndex: endRow,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      mergeType: "MERGE_ALL",
    },
  };
}

/** Pone bordes alrededor y entre celdas en un rango. */
export function bordersReq(sheetId, startRow, endRow, startCol, endCol) {
  const border = { style: "SOLID", color: COLORS.borde };
  return {
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: startRow,
        endRowIndex: endRow,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      top: border,
      bottom: border,
      left: border,
      right: border,
      innerHorizontal: border,
      innerVertical: border,
    },
  };
}

/** Altura de filas o ancho de columnas. */
export function dimensionReq(sheetId, dim, startIdx, endIdx, pixelSize) {
  return {
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: dim, // "ROWS" | "COLUMNS"
        startIndex: startIdx,
        endIndex: endIdx,
      },
      properties: { pixelSize },
      fields: "pixelSize",
    },
  };
}

/** Freeze de filas. */
export function freezeRowsReq(sheetId, frozenRowCount) {
  return {
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount },
      },
      fields: "gridProperties.frozenRowCount",
    },
  };
}

/** Filtro básico sobre un rango. */
export function basicFilterReq(sheetId, startRow, endRow, startCol, endCol) {
  return {
    setBasicFilter: {
      filter: {
        range: {
          sheetId,
          startRowIndex: startRow,
          endRowIndex: endRow,
          startColumnIndex: startCol,
          endColumnIndex: endCol,
        },
      },
    },
  };
}

/** Grupo de filas colapsable. */
export function addRowGroupReq(sheetId, startRow, endRow) {
  return {
    addDimensionGroup: {
      range: {
        sheetId,
        dimension: "ROWS",
        startIndex: startRow,
        endIndex: endRow,
      },
    },
  };
}

/** Formatos numéricos comunes. */
export const NF = {
  monedaArs: '"$"#,##0.00;[Red]("$"#,##0.00);-',
  monedaArsSimple: '"$"#,##0.00',
  monedaArsEntera: '"$"#,##0',
  fecha: "dd/mm/yyyy",
  pct: "0.00%",
  entero: "#,##0",
};
