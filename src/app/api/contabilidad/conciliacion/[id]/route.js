import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { trashearArchivo } from "@/lib/reportes-cc/google-client";

export const runtime = "nodejs";

function autorizado(session) {
  return session && (session.user.role === "CONTABILIDAD" || session.user.role === "ADMIN");
}

export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!autorizado(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const reporte = await prisma.conciliacionMP.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!reporte) return NextResponse.json({ error: "Conciliación no encontrada" }, { status: 404 });

  return NextResponse.json({
    id: reporte.id,
    fuente: reporte.fuente,
    spreadsheetId: reporte.spreadsheetId,
    spreadsheetUrl: reporte.spreadsheetUrl,
    embedUrl: `https://docs.google.com/spreadsheets/d/${reporte.spreadsheetId}/edit?usp=sharing`,
    gbpOps: reporte.gbpOps,
    cobradas: reporte.cobradas,
    pendientes: reporte.pendientes,
    sobrantes: reporte.sobrantes,
    montoCobrado: Number(reporte.montoCobrado),
    montoPendiente: Number(reporte.montoPendiente),
    montoSobrante: Number(reporte.montoSobrante),
    resumen: reporte.resumenJson,
    createdAt: reporte.createdAt,
    user: reporte.user,
  });
}

export async function DELETE(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!autorizado(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const reporte = await prisma.conciliacionMP.findUnique({ where: { id } });
  if (!reporte) return NextResponse.json({ error: "Conciliación no encontrada" }, { status: 404 });

  let driveOk = true;
  let driveError = null;
  try {
    await trashearArchivo(reporte.spreadsheetId);
  } catch (e) {
    driveOk = false;
    driveError = e.message;
    console.error("Error al trashear Sheet de conciliación:", e);
  }

  await prisma.conciliacionMP.delete({ where: { id } });

  return NextResponse.json({ ok: true, driveOk, driveError });
}
