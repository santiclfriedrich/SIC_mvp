import { NextResponse } from "next/server";
import { getProductBySku } from "@/lib/controllers/productController";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const sku = (params?.sku || "").trim();
    if (!sku) return NextResponse.json({ error: "SKU inválido" }, { status: 400 });

    const data = await getProductBySku({ sku });

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("GET /api/products/:sku error:", err);
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 });
  }
}
