import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

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
