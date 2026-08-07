import { prisma } from "@/lib/prisma";

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

export async function POST(request, { params }) {
  const { id } = await params;
  const hid = parseInt(id, 10);
  if (!Number.isInteger(hid)) return Response.json({ error: "id inválido" }, { status: 400 });
  const d = await request.json().catch(() => ({}));
  const sets = [], vals = [];
  if ("comentario" in d) { vals.push((d.comentario || "").trim()); sets.push(`comentario = $${vals.length}`); }
  if ("areas" in d) { vals.push(JSON.stringify(cleanAreas(d.areas))); sets.push(`areas = $${vals.length}`); }
  if (ESTADOS.includes(d.estado)) { vals.push(d.estado); sets.push(`estado = $${vals.length}`); }
  if (!sets.length) return Response.json({ error: "nada para actualizar" }, { status: 400 });
  vals.push(new Date().toISOString()); sets.push(`updated_at = $${vals.length}`);
  try {
    await prisma.$executeRawUnsafe(`UPDATE historico_ajustes SET ${sets.join(", ")} WHERE id = ${hid}`, ...vals);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const hid = parseInt(id, 10);
  if (!Number.isInteger(hid)) return Response.json({ error: "id inválido" }, { status: 400 });
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM historico_ajustes WHERE id = ${hid}`);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
