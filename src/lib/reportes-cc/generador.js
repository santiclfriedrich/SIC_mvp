// Orquestador: crea el Spreadsheet, agrega las 3 hojas, las construye,
// lo comparte públicamente con link.

import {
  crearSpreadsheet,
  compartirConLink,
  batchUpdate,
  listarSheets,
} from "./google-client";
import { HOJA_RESUMEN, HOJA_DETALLE, HOJA_DASHBOARD } from "./config";
import { buildResumen } from "./builder-resumen";
import { buildDetalle } from "./builder-detalle";
import { buildDashboard } from "./builder-dashboard";
import { leerNotasDetalle } from "./notas-previas";

/**
 * Genera el Spreadsheet completo con las 3 hojas formateadas.
 *
 * @param {Object} datos
 *   - clientes: array procesado (con vendedoresStr)
 *   - totales: {totalDeuda, totalClientes, totalComp, promedio, sinComp}
 *   - porVendedor: [{vendedor, saldo}]
 *   - fuente: nombre del archivo original
 *   - spreadsheetAnteriorId: (opcional) Sheet del último reporte, del que se
 *       copian las notas de la col I hacia el reporte nuevo.
 * @returns {Promise<{spreadsheetId, spreadsheetUrl}>}
 */
export async function generarSpreadsheet({ clientes, totales, porVendedor, fuente, spreadsheetAnteriorId }) {
  const fechaTitulo = new Date().toLocaleDateString("es-AR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const titulo = `Reporte CC — ${fechaTitulo}`;

  // Notas del reporte anterior (col I), para re-inyectarlas por cliente/comprobante.
  const notas = await leerNotasDetalle(spreadsheetAnteriorId);

  // 1) Crear el Spreadsheet vacío en la carpeta destino
  const { spreadsheetId, spreadsheetUrl } = await crearSpreadsheet(titulo);

  // 2) Agregar las 3 hojas y borrar la "Sheet1" inicial
  const sheetsActuales = await listarSheets(spreadsheetId);
  const sheet1Id = sheetsActuales[Object.keys(sheetsActuales)[0]];

  await batchUpdate(spreadsheetId, [
    { addSheet: { properties: { title: HOJA_DASHBOARD, index: 0 } } },
    { addSheet: { properties: { title: HOJA_RESUMEN, index: 1 } } },
    { addSheet: { properties: { title: HOJA_DETALLE, index: 2 } } },
    { deleteSheet: { sheetId: sheet1Id } },
  ]);

  // 3) Obtener los IDs de las hojas recién creadas
  const ids = await listarSheets(spreadsheetId);

  // 4) Construir cada hoja con sus requests
  const reqResumen = buildResumen(ids[HOJA_RESUMEN], clientes, fuente);
  const reqDetalle = buildDetalle(ids[HOJA_DETALLE], clientes, notas);
  const reqDashboard = buildDashboard(
    ids[HOJA_DASHBOARD],
    clientes,
    totales,
    porVendedor,
    fuente
  );

  // 5) Ejecutar los batches por hoja (los hago separados por si alguno falla
  //    podemos diagnosticar más fácil)
  await batchUpdate(spreadsheetId, reqResumen);
  await batchUpdate(spreadsheetId, reqDetalle);
  await batchUpdate(spreadsheetId, reqDashboard);

  // 6) Compartir con link (editor anónimo)
  await compartirConLink(spreadsheetId, "writer");

  return { spreadsheetId, spreadsheetUrl, titulo };
}
