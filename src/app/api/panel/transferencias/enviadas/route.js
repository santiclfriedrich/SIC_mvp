import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = 'transf_enviadas'`);
    if (!rows.length) return Response.json({});
    return Response.json(jsonSafe(JSON.parse(rows[0].value) || {}));
  } catch {
    return Response.json({});
  }
}
