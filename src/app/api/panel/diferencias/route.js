import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";
import { diferenciasRows } from "@/lib/panel/diferencias";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const solo = (searchParams.get("solo") ?? "1") !== "0";
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const sort = searchParams.get("sort") || "desvio";
  const dirDesc = searchParams.get("dir") !== "asc";
  try {
    const { info, kpi, rows } = await diferenciasRows(prisma, { solo, q, sort, dirDesc });
    if (!info) return Response.json({ sgl_info: null, rows: [], kpi: null });
    return Response.json(jsonSafe({ sgl_info: info, kpi, rows: rows.slice(0, 500) }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
