import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";

export const dynamic = "force-dynamic";

async function meta(key, def = null) {
  const rows = await prisma.$queryRawUnsafe(`SELECT value FROM meta WHERE key = '${key}'`);
  if (!rows.length) return def;
  try { return JSON.parse(rows[0].value); } catch { return def; }
}

export async function GET() {
  try {
    let sync = await meta("sync", null);
    if (sync && sync.state === "running") {
      const t = sync.at ? new Date(sync.at).getTime() : NaN;
      const age = Number.isFinite(t) ? (Date.now() - t) / 1000 : Infinity;
      if (!sync.at || age > 900) {
        sync = { ...sync, state: "error", detail: "la corrida anterior no terminó; volvé a sincronizar" };
      }
    }
    const counts = {};
    for (const tbl of ["items", "stock", "prices", "storages"]) {
      const [row] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM ${tbl}`);
      counts[tbl] = Number(row.c);
    }
    return Response.json(jsonSafe({
      sync,
      last_sync: await meta("last_sync", null),
      counts,
      auto_sync_minutes: 60,
    }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
