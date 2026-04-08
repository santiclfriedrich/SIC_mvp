// /api/cron/sync-airintra
//
// Descarga el catálogo completo de AirIntra y lo guarda en Redis (bloqueante).
// Llamado por Vercel Cron Jobs (vercel.json) cada día.
// Protegido con CRON_SECRET.

import { NextResponse } from "next/server";
import { syncAirIntraCatalogToRedis } from "@/lib/services/airintraAPI";

export const runtime     = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const secret     = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("🔵 [Cron] sync-airintra iniciado");
  const start = Date.now();

  try {
    const result  = await syncAirIntraCatalogToRedis();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ [Cron] sync-airintra completado en ${elapsed}s`);
    return NextResponse.json({ ...result, elapsed: `${elapsed}s` });
  } catch (err) {
    console.error("❌ [Cron] sync-airintra falló:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
