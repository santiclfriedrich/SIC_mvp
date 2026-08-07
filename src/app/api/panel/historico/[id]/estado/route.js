import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ESTADOS = ["en_proceso", "finalizado"];

export async function POST(request, { params }) {
  const { id } = await params;
  const hid = parseInt(id, 10);
  if (!Number.isInteger(hid)) return Response.json({ error: "id inválido" }, { status: 400 });
  const d = await request.json().catch(() => ({}));
  if (!ESTADOS.includes(d.estado)) return Response.json({ error: "estado inválido" }, { status: 400 });
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE historico_ajustes SET estado = $1, updated_at = $2 WHERE id = ${hid}`,
      d.estado, new Date().toISOString()
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
