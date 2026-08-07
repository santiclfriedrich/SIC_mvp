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
    // Corrida muerta: un 'running' sin progreso hace >15 min quedó interrumpido.
    if (sync && sync.state === "running" && sync.at) {
      const age = (Date.now() - new Date(sync.at).getTime()) / 1000;
      if (Number.isFinite(age) && age > 900) {
        sync = { ...sync, state: "error", detail: "quedó interrumpida; volvé a sincronizar" };
      }
    }
    const counts = {};
    for (const t of ["items", "stock", "prices", "storages"]) {
      const [row] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM ${t}`);
      counts[t] = Number(row.c);
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
