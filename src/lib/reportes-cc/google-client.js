// Cliente de Google Sheets + Drive autenticado con service account.
// Las credenciales viven en GOOGLE_SERVICE_ACCOUNT_JSON (env).

import { google } from "googleapis";
import { Readable } from "node:stream";

let cachedAuth = null;

function getAuth() {
  if (cachedAuth) return cachedAuth;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON en el environment");
  }

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no es JSON válido: " + e.message);
  }

  cachedAuth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  return cachedAuth;
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: getAuth() });
}

/**
 * Crea un Spreadsheet vacío con el título dado, dentro de la carpeta configurada.
 * Devuelve { spreadsheetId, spreadsheetUrl }.
 */
export async function crearSpreadsheet(titulo) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("Falta GOOGLE_DRIVE_FOLDER_ID en el environment");
  }

  const drive = getDriveClient();

  // Drive.files.create es más confiable que sheets.create para ubicar el archivo
  // directamente en la carpeta destino.
  const res = await drive.files.create({
    requestBody: {
      name: titulo,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return {
    spreadsheetId: res.data.id,
    spreadsheetUrl: res.data.webViewLink,
  };
}

/**
 * Hace que el Spreadsheet sea editable por cualquiera con el link.
 * Esto permite que el iframe funcione sin que el usuario se loguee con Google.
 *
 * En Shared Drives, primero hay que permitir compartir externamente —
 * normalmente las políticas del Workspace lo permiten por defecto.
 */
export async function compartirConLink(spreadsheetId, role = "writer") {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { type: "anyone", role }, // role: "writer" | "reader"
    supportsAllDrives: true,
  });
}

/**
 * Ejecuta una serie de batchUpdate requests sobre el Spreadsheet.
 */
export async function batchUpdate(spreadsheetId, requests) {
  if (!requests || requests.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

/**
 * Escribe valores en un rango (A1 notation). Equivalente a setValues() del Script.
 * `valueInputOption`: "USER_ENTERED" (default, parsea números/fórmulas) o "RAW".
 */
export async function escribirValores(spreadsheetId, rangoA1, valores, valueInputOption = "USER_ENTERED") {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: rangoA1,
    valueInputOption,
    requestBody: { values: valores },
  });
}

/** Limpia (vacía) el contenido de un rango / hoja entera (A1 notation). */
export async function limpiarValores(spreadsheetId, rangoA1) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: rangoA1 });
}

/**
 * Trae los IDs de las hojas (por nombre) del Spreadsheet.
 */
export async function listarSheets(spreadsheetId) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const map = {};
  for (const s of meta.data.sheets) {
    map[s.properties.title] = s.properties.sheetId;
  }
  return map;
}

/**
 * Copia una fila completa (fórmulas + formato) a otra fila dentro de la misma
 * hoja. `srcRow` / `dstRow` son números de fila 1-based.
 */
export async function copiarFila(spreadsheetId, sheetId, srcRow, dstRow) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          copyPaste: {
            source: {
              sheetId,
              startRowIndex: srcRow - 1,
              endRowIndex: srcRow,
            },
            destination: {
              sheetId,
              startRowIndex: dstRow - 1,
              endRowIndex: dstRow,
            },
            pasteType: "PASTE_NORMAL",
          },
        },
      ],
    },
  });
}

/**
 * Devuelve el nombre actual del archivo en Drive.
 * Devuelve null si el archivo ya no existe o no es accesible.
 */
export async function obtenerNombreArchivo(spreadsheetId) {
  const drive = getDriveClient();
  try {
    const res = await drive.files.get({
      fileId: spreadsheetId,
      fields: "name, trashed",
      supportsAllDrives: true,
    });
    if (res.data.trashed) return null;
    return res.data.name;
  } catch {
    return null;
  }
}

/**
 * Envía el archivo a la papelera del Shared Drive (reversible).
 */
export async function trashearArchivo(spreadsheetId) {
  const drive = getDriveClient();
  await drive.files.update({
    fileId: spreadsheetId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
}

/**
 * Sube un .xlsx crudo a la carpeta configurada (SIN convertir). Devuelve el id.
 * Se usa para guardar la planilla como "molde" del export a Sheets.
 */
export async function subirXlsx(buffer, nombre) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("Falta GOOGLE_DRIVE_FOLDER_ID en el environment");

  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: { name: nombre, parents: [folderId] },
    media: {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Readable.from(buffer),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id;
}

/**
 * Copia un archivo de Drive CONVIRTIÉNDOLO a Google Spreadsheet (conserva hojas,
 * formato y fórmulas del .xlsx). Devuelve { spreadsheetId, spreadsheetUrl }.
 */
export async function copiarComoSheet(fileId, nombre) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const drive = getDriveClient();
  const res = await drive.files.copy({
    fileId,
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: folderId ? [folderId] : undefined,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  return { spreadsheetId: res.data.id, spreadsheetUrl: res.data.webViewLink };
}

/** Lee un rango (A1) de un Spreadsheet. Devuelve la matriz de valores. */
export async function leerRango(spreadsheetId, rangoA1) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangoA1 });
  return res.data.values || [];
}

/**
 * Lee varios rangos en una sola llamada (batchGet). Devuelve los valueRanges en
 * el mismo orden. Usa UNFORMATTED_VALUE (números nativos, fórmulas ya resueltas).
 */
export async function leerRangos(spreadsheetId, ranges) {
  if (!ranges || ranges.length === 0) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.valueRanges || [];
}

/**
 * Escribe varios rangos de una en una sola llamada.
 * @param {Array<{range:string, values:any[][]}>} data
 */
export async function valoresBatchUpdate(spreadsheetId, data) {
  if (!data || data.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}
