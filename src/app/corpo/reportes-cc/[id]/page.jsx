import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReporteDetalleClient } from "./ReporteDetalleClient";

export default async function ReporteDetallePage({ params }) {
  const { id } = await params;
  const reporte = await prisma.reporteCC.findUnique({
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
    totalDeuda: Number(reporte.totalDeuda),
    totalClientes: reporte.totalClientes,
    totalComp: reporte.totalComp,
    excluidos: reporte.excluidos,
    clientes: reporte.clientesJson,
    porVendedor: reporte.porVendedorJson,
    createdAt: reporte.createdAt.toISOString(),
    user: reporte.user,
  };

  return <ReporteDetalleClient data={data} />;
}
