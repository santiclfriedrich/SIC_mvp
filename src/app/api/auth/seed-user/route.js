import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ROLES_VALIDOS = ["ADMIN", "USER", "VIEWER", "CORPO", "TIENDAS"];

export async function POST(req) {
  try {
    const body = await req.json();

    const key = body?.key || "";
    const email = (body?.email || "").toLowerCase().trim();
    const password = body?.password || "";
    const name = body?.name || email.split("@")[0];
    const role = (body?.role || "USER").toUpperCase();

    if (!process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Falta ADMIN_SEED_KEY" }, { status: 500 });
    }
    if (key !== process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Key inválida" }, { status: 401 });
    }
    if (!email || !password) {
      return NextResponse.json({ error: "Email y password requeridos" }, { status: 400 });
    }
    if (!ROLES_VALIDOS.includes(role)) {
      return NextResponse.json(
        { error: `Rol inválido. Usá uno de: ${ROLES_VALIDOS.join(", ")}` },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, password: hash, role, isActive: true },
      create: { email, name, password: hash, role, isActive: true },
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error("seed-user error:", e);
    return NextResponse.json({ error: "Error: " + e.message }, { status: 500 });
  }
}
