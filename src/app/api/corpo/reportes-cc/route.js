import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  parsearClientes,
  filtrarYOrdenar,
  calcularTotales,
  deudaPorVendedor,
} from "@/lib/reportes-cc/parser";
import { generarSpreadsheet } from "@/lib/reportes-cc/generador";
import { obtenerNombreArchivo } from "@/lib/reportes-cc/google-client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/corpo/reportes-cc
 * Recibe el .xls del ERP, lo procesa, crea el Spreadsheet en Drive
 * y guarda el reporte en la DB.
 */
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "CORPO" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const fileName = file.name || "archivo.xlsx";
  const ext = fileName.toLowerCase();
  if (!ext.endsWith(".xls") && !ext.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Formato no soportado. Usá .xls o .xlsx" }, { status: 400 });
  }

  let datos;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    datos = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  } catch (e) {
    return NextResponse.json({ error: "No se pudo leer el archivo: " + e.message }, { status: 400 });
  }

  const todos = parsearClientes(datos);
  if (todos.length === 0) {
    return NextResponse.json(
      { error: "No se detectaron clientes en el archivo. ¿Es el reporte crudo del ERP?" },
      { status: 422 }
    );
  }

  const { clientes, excluidos } = filtrarYOrdenar(todos);
  const totales = calcularTotales(clientes);
  const porVendedor = deudaPorVendedor(clientes);

  if (clientes.length === 0) {
    return NextResponse.json(
      { error: "Todos los clientes quedaron excluidos por filtros (vendedor / umbral)." },
      { status: 422 }
    );
  }

  // Último reporte generado: de ahí se copian las notas (col I) al nuevo.
  const anterior = await prisma.reporteCC.findFirst({
    orderBy: { createdAt: "desc" },
    select: { spreadsheetId: true },
  });

  // Generar el Sheet
  let spreadsheetId, spreadsheetUrl;
  try {
    const out = await generarSpreadsheet({
      clientes,
      totales,
      porVendedor,
      fuente: fileName,
      spreadsheetAnteriorId: anterior?.spreadsheetId,
    });
    spreadsheetId = out.spreadsheetId;
    spreadsheetUrl = out.spreadsheetUrl;
  } catch (e) {
    console.error("Error generando Spreadsheet:", e);
    return NextResponse.json(
      { error: "Error al generar el Sheet: " + e.message },
      { status: 500 }
    );
  }

  // Persistir en DB
  const reporte = await prisma.reporteCC.create({
    data: {
      userId: session.user.id,
      fuente: fileName,
      spreadsheetId,
      spreadsheetUrl,
      totalDeuda: totales.totalDeuda,
      totalClientes: totales.totalClientes,
      totalComp: totales.totalComp,
      excluidos,
      clientesJson: clientes.map((c) => ({
        numero: String(c.numero ?? ""),
        nombre: c.nombre ?? "",
        vendedor: c.vendedoresStr || "—",
        cantComprobantes: c.comprobantes.length,
        saldoTotal: c.saldo_total || 0,
      })),
      porVendedorJson: porVendedor,
    },
  });

  return NextResponse.json({
    ok: true,
    id: reporte.id,
    spreadsheetId,
    spreadsheetUrl,
    embedUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`,
  });
}

/**
 * GET /api/corpo/reportes-cc
 * Lista los reportes generados (último primero).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CORPO" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reportes = await prisma.reporteCC.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fuente: true,
      spreadsheetId: true,
      spreadsheetUrl: true,
      totalDeuda: true,
      totalClientes: true,
      totalComp: true,
      excluidos: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  // Trae el nombre actual de cada Sheet desde Drive (en paralelo).
  // Si el archivo fue trasheado o no es accesible, devuelve null y la UI muestra "Archivo eliminado".
  const nombres = await Promise.all(
    reportes.map((r) => obtenerNombreArchivo(r.spreadsheetId))
  );

  return NextResponse.json({
    reportes: reportes.map((r, i) => ({
      ...r,
      totalDeuda: Number(r.totalDeuda),
      nombreArchivo: nombres[i],
    })),
  });
}
