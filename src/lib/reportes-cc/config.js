// Constantes del reporte de cuentas corrientes — espejo del Apps Script original.

export const VENDEDORES_EXCLUIDOS = [
  "Ventas Web",
  "MercadoLibre",
  "Alan Impagliazzo",
  "Emiliano Alfaro",
  "Mariano Olvar",
  "Mariano Olvar, Ventas Web",
  "MercadoLibre, Ventas Web",
];

// Solo se incluyen clientes cuyo saldo adeudado sea MAYOR a este umbral.
export const UMBRAL_SALDO = 100;

export const COLOR_TITULO = "#1F4E78";
export const COLOR_HEADER = "#2E75B6";
export const COLOR_TOTAL = "#FFE699";
export const COLOR_CLIENTE = "#DDEBF7";
export const COLOR_ALT = "#F8F9FA";
export const COLOR_BORDE = "#BFBFBF";

export const HOJA_RESUMEN = "Resumen por Cliente";
export const HOJA_DETALLE = "Detalle Comprobantes";
export const HOJA_DASHBOARD = "Dashboard";

export const FMT_MONEDA = '"$"#,##0.00;[Red]("$"#,##0.00);-';
export const FMT_FECHA = "dd/mm/yyyy";
export const FMT_PCT = "0.00%";
