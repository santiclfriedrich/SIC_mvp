import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTiendas } from "@/lib/pricing/server";
import { crearPlanillaViva } from "@/lib/pricing/sheet-sync";
import { trashearArchivo } from "@/lib/reportes-cc/google-client";

export const runtime = "nodejs";
export const maxDuration = 120;

const urlDe = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`;

/** GET /api/tiendas/planilla-viva — estado de la planilla viva. */
export async function GET() {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const meta = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  return NextResponse.json({
    existe: !!meta?.livePlanillaId,
    url: meta?.livePlanillaId ? urlDe(meta.livePlanillaId) : null,
    skus: meta?.skuRowMapJson ? Object.keys(meta.skuRowMapJson).length : 0,
    tieneMolde: !!meta?.moldeFileId,
  });
}

/**
 * POST /api/tiendas/planilla-viva — crea (o re-crea) la planilla viva desde el
 * molde. Si ya había una, la manda a la papelera.
 */
export async function POST() {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const prev = await prisma.report21Upload.findUnique({ where: { id: 1 } });
  const prevId = prev?.livePlanillaId;

  let res;
  try {
    res = await crearPlanillaViva();
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }

  if (prevId && prevId !== res.spreadsheetId) {
    await trashearArchivo(prevId).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    url: res.spreadsheetUrl || urlDe(res.spreadsheetId),
    embedUrl: urlDe(res.spreadsheetId),
    skus: res.skus,
  });
}
