import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { CUENTAS_MP, cruzar } from "@/lib/conciliacion/parser";
import { generarSpreadsheet } from "@/lib/conciliacion/generador";
import { obtenerNombreArchivo } from "@/lib/reportes-cc/google-client";

export const runtime = "nodejs";
export const maxDuration = 60;

function autorizado(session) {
  return session && (session.user.role === "CONTABILIDAD" || session.user.role === "ADMIN");
}

/**
 * POST /api/contabilidad/conciliacion
 * Recibe el .xlsx con las hojas gbp/argcol/kanji/ganga, cruza GBP ↔ MercadoPago,
 * genera el Sheet en Drive y guarda el registro en la DB.
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!autorizado(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body debe ser multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Falta el archivo en el campo 'file'" }, { status: 400 });
  }

  const fileName = file.name || "reporte.xlsx";
  if (!fileName.toLowerCase().endsWith(".xls") && !fileName.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Formato no soportado. Usá .xls o .xlsx" }, { status: 400 });
  }

  // Leer el workbook y extraer las 4 hojas (nombres case-insensitive).
  let matrices;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const porNombre = {};
    for (const nombre of wb.SheetNames) porNombre[nombre.toLowerCase().trim()] = nombre;

    const faltantes = [];
    matrices = {};
    for (const hoja of ["gbp", ...CUENTAS_MP]) {
      const real = porNombre[hoja];
      if (!real) {
        faltantes.push(hoja);
        continue;
      }
      matrices[hoja] = XLSX.utils.sheet_to_json(wb.Sheets[real], {
        header: 1, defval: "", blankrows: false,
      });
    }
    if (faltantes.length > 0) {
      return NextResponse.json(
        { error: `Al archivo le faltan estas hojas: ${faltantes.join(", ")}. Deben llamarse gbp, argcol, kanji y ganga.` },
        { status: 422 }
      );
    }
  } catch (e) {
    return NextResponse.json({ error: "No se pudo leer el archivo: " + e.message }, { status: 400 });
  }

  const cruce = cruzar(matrices);
  if (cruce.totales.gbpOps === 0) {
    return NextResponse.json(
      { error: "No se detectaron operaciones en la hoja gbp (columna Nro_Operacion_Limpio vacía?)." },
      { status: 422 }
    );
  }

  let spreadsheetId, spreadsheetUrl;
  try {
    const out = await generarSpreadsheet({ cruce, fuente: fileName });
    spreadsheetId = out.spreadsheetId;
    spreadsheetUrl = out.spreadsheetUrl;
  } catch (e) {
    console.error("Error generando Spreadsheet de conciliación:", e);
    return NextResponse.json({ error: "Error al generar el Sheet: " + e.message }, { status: 500 });
  }

  const t = cruce.totales;
  const reporte = await prisma.conciliacionMP.create({
    data: {
      userId: session.user.id,
      fuente: fileName,
      spreadsheetId,
      spreadsheetUrl,
      gbpOps: t.gbpOps,
      cobradas: t.cobradas,
      pendientes: t.pendientes,
      sobrantes: t.sobrantes,
      montoCobrado: t.montoCobrado,
      montoPendiente: t.montoPendiente,
      montoSobrante: t.montoSobrante,
      resumenJson: t,
    },
  });

  return NextResponse.json({
    ok: true,
    id: reporte.id,
    spreadsheetId,
    spreadsheetUrl,
    embedUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`,
    totales: t,
  });
}

/** GET /api/contabilidad/conciliacion — lista las conciliaciones (última primero). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!autorizado(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reportes = await prisma.conciliacionMP.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fuente: true,
      spreadsheetId: true,
      spreadsheetUrl: true,
      gbpOps: true,
      cobradas: true,
      pendientes: true,
      sobrantes: true,
      montoCobrado: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const nombres = await Promise.all(reportes.map((r) => obtenerNombreArchivo(r.spreadsheetId)));

  return NextResponse.json({
    reportes: reportes.map((r, i) => ({
      ...r,
      montoCobrado: Number(r.montoCobrado),
      nombreArchivo: nombres[i],
    })),
  });
}
