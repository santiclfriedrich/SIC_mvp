import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let value = NaN;
  try {
    value = Number((await request.json())?.value);
  } catch {}
  if (!Number.isFinite(value) || value <= 0) {
    return Response.json({ error: "valor inválido" }, { status: 400 });
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO meta (key, value) VALUES ('cotizacion', '${JSON.stringify(value)}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
  );
  return Response.json({ cotizacion: value });
}
