import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

console.log("ADMIN_SEED_KEY cargada?", Boolean(process.env.ADMIN_SEED_KEY));


const prisma = new PrismaClient();

export async function POST(req) {

  console.log("ADMIN_SEED_KEY runtime:", process.env.ADMIN_SEED_KEY);


  try {
    const body = await req.json();

    const key = body?.key || "";
    const email = (body?.email || "").toLowerCase().trim();
    const password = body?.password || "";
    const name = body?.name || "Admin";

    if (!process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Falta ADMIN_SEED_KEY" }, { status: 500 });
    }
    if (key !== process.env.ADMIN_SEED_KEY) {
      return NextResponse.json({ error: "Key inválida" }, { status: 401 });
    }
    if (!email || !password) {
      return NextResponse.json({ error: "Email y password requeridos" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: hash,
        role: "ADMIN",
        isActive: true,
      },
      create: {
        email,
        name,
        password: hash,
        role: "ADMIN",
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) {
    console.error("seed-admin error:", e);
    return NextResponse.json({ error: "Error seed-admin" }, { status: 500 });
  }
}
