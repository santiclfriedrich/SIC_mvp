import { NextResponse } from "next/server";
import { requireTiendas } from "@/lib/pricing/server";
import { getPricingConfig } from "@/lib/pricing/config";
import { sincronizarDesdeViva } from "@/lib/pricing/sheet-sync";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/tiendas/planilla-viva/sync
 * Trae a la web los precios/LP editados en la planilla viva (Sheet → web).
 */
export async function POST() {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const config = await getPricingConfig();
  let res;
  try {
    res = await sincronizarDesdeViva(config);
  } catch (e) {
    return NextResponse.json({ error: "Error leyendo la planilla: " + e.message }, { status: 500 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: res.motivo || "No se pudo sincronizar" }, { status: 422 });
  }
  return NextResponse.json({ ok: true, actualizados: res.actualizados });
}
