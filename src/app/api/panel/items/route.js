import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";
import { buildItemsSql } from "@/lib/panel/items-sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const perPage = 50;
  const { selectSql, countSql, params } = buildItemsSql(searchParams);
  try {
    const countRows = await prisma.$queryRawUnsafe(countSql, ...params);
    const total = Number(countRows[0]?.c || 0);
    const rows = await prisma.$queryRawUnsafe(
      `${selectSql} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
      ...params
    );
    return Response.json(jsonSafe({ total, page, per_page: perPage, rows }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
