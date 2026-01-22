import { NextResponse } from "next/server";

// Importá tu lógica actual (vamos a moverla en el paso 2)
import { getAllProducts } from "@/lib/controllers/productController";

export const runtime = "nodejs";

// /api/products?q=nombre
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    const data = await getAllProducts({ q });

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}
