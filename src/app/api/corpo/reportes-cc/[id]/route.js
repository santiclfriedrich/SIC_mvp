import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { trashearArchivo } from "@/lib/reportes-cc/google-client";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CORPO" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const reporte = await prisma.reporteCC.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: reporte.id,
    fuente: reporte.fuente,
    spreadsheetId: reporte.spreadsheetId,
    spreadsheetUrl: reporte.spreadsheetUrl,
    embedUrl: `https://docs.google.com/spreadsheets/d/${reporte.spreadsheetId}/edit?usp=sharing`,
    totalDeuda: Number(reporte.totalDeuda),
    totalClientes: reporte.totalClientes,
    totalComp: reporte.totalComp,
    excluidos: reporte.excluidos,
    clientes: reporte.clientesJson,
    porVendedor: reporte.porVendedorJson,
    createdAt: reporte.createdAt,
    user: reporte.user,
  });
}

export async function DELETE(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "CORPO" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const reporte = await prisma.reporteCC.findUnique({ where: { id } });
  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }

  // Trashear el Sheet en Drive (no fatal si falla — el registro de DB se borra igual).
  let driveOk = true;
  let driveError = null;
  try {
    await trashearArchivo(reporte.spreadsheetId);
  } catch (e) {
    driveOk = false;
    driveError = e.message;
    console.error("Error al trashear Sheet:", e);
  }

  await prisma.reporteCC.delete({ where: { id } });

  return NextResponse.json({ ok: true, driveOk, driveError });
}
