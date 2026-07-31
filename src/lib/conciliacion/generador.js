// Orquestador: crea el Spreadsheet de conciliación con 4 hojas (Resumen,
// Cobradas, Pendientes, MP sin GBP), las construye y lo comparte con link.

import {
  crearSpreadsheet,
  compartirConLink,
  batchUpdate,
  listarSheets,
} from "@/lib/reportes-cc/google-client";
import {
  HOJA_RESUMEN,
  HOJA_COBRADAS,
  HOJA_PENDIENTES,
  HOJA_SOBRANTES,
  buildResumen,
  buildCobradas,
  buildPendientes,
  buildSobrantes,
} from "./builder";

/**
 * @param {Object} cruce  { cobradas, pendientes, sobrantes, totales }
 * @param {string} fuente nombre del archivo subido
 * @returns {Promise<{spreadsheetId, spreadsheetUrl, titulo}>}
 */
export async function generarSpreadsheet({ cruce, fuente }) {
  const fechaTitulo = new Date().toLocaleDateString("es-AR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const titulo = `Conciliación MP — ${fechaTitulo}`;

  const { spreadsheetId, spreadsheetUrl } = await crearSpreadsheet(titulo);

  // Agregar las 4 hojas y borrar la "Sheet1" inicial.
  const sheetsActuales = await listarSheets(spreadsheetId);
  const sheet1Id = sheetsActuales[Object.keys(sheetsActuales)[0]];

  await batchUpdate(spreadsheetId, [
    { addSheet: { properties: { title: HOJA_RESUMEN, index: 0 } } },
    { addSheet: { properties: { title: HOJA_COBRADAS, index: 1 } } },
    { addSheet: { properties: { title: HOJA_PENDIENTES, index: 2 } } },
    { addSheet: { properties: { title: HOJA_SOBRANTES, index: 3 } } },
    { deleteSheet: { sheetId: sheet1Id } },
  ]);

  const ids = await listarSheets(spreadsheetId);

  // Batches separados por hoja (si alguno falla, se diagnostica más fácil).
  await batchUpdate(spreadsheetId, buildResumen(ids[HOJA_RESUMEN], cruce.totales, fuente));
  await batchUpdate(spreadsheetId, buildCobradas(ids[HOJA_COBRADAS], cruce.cobradas));
  await batchUpdate(spreadsheetId, buildPendientes(ids[HOJA_PENDIENTES], cruce.pendientes));
  await batchUpdate(spreadsheetId, buildSobrantes(ids[HOJA_SOBRANTES], cruce.sobrantes));

  await compartirConLink(spreadsheetId, "writer");

  return { spreadsheetId, spreadsheetUrl, titulo };
}
