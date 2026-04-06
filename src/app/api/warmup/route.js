// /api/warmup
//
// Dispara la precarga de catálogos lentos en background.
// Llamar al loguearse para que Invid (y otros) estén listos antes de la primera búsqueda.
// No espera la descarga completa — responde de inmediato.

import { NextResponse } from "next/server";
import { fetchProductsFromInvid, isInvidCacheWarm } from "@/lib/services/invidAPI";

export const runtime    = "nodejs";
export const maxDuration = 10;

export async function POST() {
  const status = {};

  // Invid: solo dispara si no está ya warm o descargando
  if (!isInvidCacheWarm()) {
    // Fire-and-forget: getInvidCatalogCached inicia la descarga background y retorna []
    fetchProductsFromInvid("").catch(() => {});
    status.invid = "warming";
  } else {
    status.invid = "already_warm";
  }

  return NextResponse.json({ ok: true, status }, { status: 200 });
}
