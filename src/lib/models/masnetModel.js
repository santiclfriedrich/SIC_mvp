// src/models/masnetModel.js

/**
 * 🔹 Normaliza productos provenientes de la API de Masnet
 */
export function formatMasnetProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts.map((p) => ({
    sku: p.codigo_producto || "",
    name: p.nombre || "",
    brand: p.marca || "",
    price: Number(p.precio) || 0,
    iva: p.iva ? `${p.iva}%` : "21%",
    currency: p.moneda === "1" ? "ARS" : "USD",
    stockLevel: p.nivel_stock || "Sin info",
    stockTotal: p.stock_total || 0,
    link: p.link || "",
    image:
      Array.isArray(p.imagenes) && p.imagenes.length > 0
        ? p.imagenes[0]
        : null,
    provider: "Masnet",
  }));
}
