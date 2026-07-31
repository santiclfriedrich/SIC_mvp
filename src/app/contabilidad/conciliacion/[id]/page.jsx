import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConciliacionDetalleClient } from "./ConciliacionDetalleClient";

export const dynamic = "force-dynamic";

export default async function ConciliacionDetallePage({ params }) {
  const { id } = await params;
  const reporte = await prisma.conciliacionMP.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!reporte) notFound();

  const data = {
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
    createdAt: reporte.createdAt.toISOString(),
    user: reporte.user,
  };

  return <ConciliacionDetalleClient data={data} />;
}
