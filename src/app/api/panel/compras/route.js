import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function meta(key) {
  const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = '${key}'`);
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

export async function GET() {
  try {
    const analysis = await meta("compras");
    const status = await meta("compras_status");
    return Response.json(jsonSafe({ analysis, status }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
