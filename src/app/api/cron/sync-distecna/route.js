// /api/cron/sync-distecna
//
// Descarga el catálogo completo de Distecna (REST paginado) y lo guarda en Redis.
// Llamado por Vercel Cron Jobs (vercel.json) cada día a las 03:00 UTC.
// Protegido con CRON_SECRET.

import { NextResponse } from "next/server";
import { syncDistecnaCatalogToRedis } from "@/lib/services/distecnaAPI";

export const runtime     = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const secret     = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("🔵 [Cron] sync-distecna iniciado");
  const start = Date.now();

  try {
    const result  = await syncDistecnaCatalogToRedis();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ [Cron] sync-distecna completado en ${elapsed}s`);
    return NextResponse.json({ ...result, elapsed: `${elapsed}s` });
  } catch (err) {
    console.error("❌ [Cron] sync-distecna falló:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
