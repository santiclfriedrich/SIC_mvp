// Lee las "Notas" (columna I) de la hoja Detalle de un reporte anterior y las
// indexa para poder re-inyectarlas al generar un reporte nuevo.
//
// Regla de matcheo (según cómo se arma la hoja en builder-detalle.js):
//   - Fila CABEZAL de cliente  -> tiene N° de cliente en la col A  -> nota por cliente.
//   - Fila de COMPROBANTE      -> col A vacía y comprobante en col D -> nota por comprobante.
//
// La lectura nunca rompe la generación: si no hay reporte anterior, la hoja no
// existe o Drive devuelve error, se devuelven diccionarios vacíos.

import { leerRango } from "./google-client";
import { HOJA_DETALLE } from "./config";

const COL_NUM_CLIENTE = 0; // A
const COL_COMPROBANTE = 3; // D
const COL_NOTA = 8; // I

export function normClave(v) {
  return String(v ?? "").trim();
}

/**
 * @param {string|null|undefined} spreadsheetId  Sheet del reporte anterior.
 * @returns {Promise<{porCliente: Object<string,string>, porComprobante: Object<string,string>}>}
 */
export async function leerNotasDetalle(spreadsheetId) {
  const porCliente = {};
  const porComprobante = {};
  if (!spreadsheetId) return { porCliente, porComprobante };

  let filas;
  try {
    // Desde la fila 5 (los datos empiezan ahí; la 4 son los headers).
    filas = await leerRango(spreadsheetId, `'${HOJA_DETALLE}'!A5:I100000`);
  } catch {
    return { porCliente, porComprobante };
  }

  for (const row of filas || []) {
    const nota = normClave(row[COL_NOTA]);
    if (!nota) continue;

    const numCliente = normClave(row[COL_NUM_CLIENTE]);
    const comprobante = normClave(row[COL_COMPROBANTE]);

    if (numCliente) {
      // Fila cabezal: la nota se guarda contra el N° de cliente.
      porCliente[numCliente] = nota;
    } else if (comprobante) {
      // Fila de comprobante: la nota se guarda contra el N° de comprobante.
      porComprobante[comprobante] = nota;
    }
  }

  return { porCliente, porComprobante };
}
