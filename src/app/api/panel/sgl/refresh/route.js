import { prisma } from "@/lib/prisma";
import { fetchStock, replaceSglStock } from "@/lib/panel/sgl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const { rows, snapshot } = await fetchStock();
    if (!rows.length) throw new Error("SGL devolvió 0 artículos");
    const info = { at: new Date().toISOString(), file: null, rows: rows.length, source: "api", snapshot };
    await replaceSglStock(prisma, rows, info);
    return Response.json({ ok: true, rows: rows.length, snapshot });
  } catch (e) {
    return Response.json({ error: `No se pudo consultar SGL: ${e?.message || e}` }, { status: 502 });
  }
}
