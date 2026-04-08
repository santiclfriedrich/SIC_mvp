// /api/cron/sync-invid
//
// Descarga el catálogo completo de INVID y lo guarda en Redis (bloqueante).
// Llamado por Vercel Cron Jobs (vercel.json) — no fire-and-forget.
// Protegido con CRON_SECRET para evitar llamadas no autorizadas.

import { NextResponse } from "next/server";
import { syncInvidCatalogToRedis } from "@/lib/services/invidAPI";

export const runtime     = "nodejs";
export const maxDuration = 60; // máximo en Vercel Hobby plan

export async function GET(request) {
  // Verificar secret (Vercel lo envía como header Authorization: Bearer <secret>)
  const authHeader = request.headers.get("authorization");
  const secret     = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("🔵 [Cron] sync-invid iniciado");
  const start = Date.now();

  try {
    const result = await syncInvidCatalogToRedis();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ [Cron] sync-invid completado en ${elapsed}s`);
    return NextResponse.json({ ...result, elapsed: `${elapsed}s` });
  } catch (err) {
    console.error("❌ [Cron] sync-invid falló:", err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
