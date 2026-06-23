import { NextResponse } from "next/server";
import { requireTiendas } from "@/lib/pricing/server";
import { getPricingConfig, savePricingConfig } from "@/lib/pricing/config";

export const runtime = "nodejs";

/** GET /api/tiendas/config — config activa (DB o defaults). */
export async function GET() {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const config = await getPricingConfig();
  return NextResponse.json({ config });
}

/** PUT /api/tiendas/config — guarda config editada (tasas/coeficientes/fees). */
export async function PUT(req) {
  const auth = await requireTiendas();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido (JSON)" }, { status: 400 });
  }

  const config = body?.config;
  if (!config || !config.stores || !config.feeTables) {
    return NextResponse.json({ error: "config debe incluir { stores, feeTables }" }, { status: 400 });
  }

  await savePricingConfig(config);
  return NextResponse.json({ ok: true, config });
}
