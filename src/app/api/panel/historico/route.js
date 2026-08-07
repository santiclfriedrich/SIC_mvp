import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/panel/query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ESTADOS = ["en_proceso", "finalizado"];

function cleanAreas(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set(), out = [];
  for (const x of v) {
    const s = String(x).trim();
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out;
}
function parseAreas(v) {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}
async function ensureTable() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS historico_ajustes (
       id BIGSERIAL PRIMARY KEY, item_id INTEGER, sku TEXT, descripcion TEXT,
       gbp DOUBLE PRECISION, sgl DOUBLE PRECISION, diff DOUBLE PRECISION,
       costo DOUBLE PRECISION, valor_diff DOUBLE PRECISION, areas TEXT,
       comentario TEXT, estado TEXT DEFAULT 'en_proceso', created_at TEXT, updated_at TEXT)`
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  try {
    await ensureTable();
    const where = [], params = [];
    if (ESTADOS.includes(estado)) { params.push(estado); where.push(`estado = $${params.length}`); }
    if (q) { params.push(`%${q}%`); const p = `$${params.length}`; where.push(`(LOWER(sku) LIKE ${p} OR LOWER(descripcion) LIKE ${p} OR LOWER(comentario) LIKE ${p})`); }
    const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, item_id, sku, descripcion, gbp, sgl, diff, costo, valor_diff, areas, comentario, estado, created_at, updated_at
         FROM historico_ajustes ${w} ORDER BY created_at DESC, id DESC`,
      ...params
    );
    const out = rows.map((r) => ({ ...r, areas: parseAreas(r.areas) }));
    return Response.json(jsonSafe({ rows: out }));
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(request) {
  const d = await request.json().catch(() => ({}));
  const sku = (d.sku || "").trim();
  if (!sku) return Response.json({ error: "falta el SKU" }, { status: 400 });
  const now = new Date().toISOString();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const estado = ESTADOS.includes(d.estado) ? d.estado : "en_proceso";
  const diff = num(d.diff);
  const areas = JSON.stringify(cleanAreas(d.areas));
  try {
    await ensureTable();
    let costo = 0;
    const itemId = d.item_id != null ? Number(d.item_id) : null;
    if (itemId) {
      const cr = await prisma.$queryRawUnsafe(`SELECT cost FROM costs WHERE item_id = ${itemId}`);
      if (cr.length && cr[0].cost) costo = Number(cr[0].cost) || 0;
    }
    const valorDiff = diff * costo;
    await prisma.$executeRawUnsafe(
      `INSERT INTO historico_ajustes (item_id, sku, descripcion, gbp, sgl, diff, costo, valor_diff, areas, comentario, estado, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      itemId, sku, d.descripcion || "", num(d.gbp), num(d.sgl), diff, costo, valorDiff, areas, (d.comentario || "").trim(), estado, now, now
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
