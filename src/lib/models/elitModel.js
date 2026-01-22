// web/src/lib/models/elitModel.js

/**
 * Normaliza productos provenientes de la API de Elit
 */
export function formatElitProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts.map((p) => ({
    sku: p.codigo_producto || p.codigo || "",
    name: p.nombre || p.descripcion || "",
    brand: p.marca || "",
    price: Number(p.precio) || 0,
    iva: p.iva ? `${p.iva}%` : "21%",
    currency: p.moneda === 1 ? "ARS" : "USD",
    stockLevel: p.nivel_stock || "Sin info",
    stockTotal: Number(p.stock_total) || 0,
    link: p.link || "",
    image: Array.isArray(p.imagenes) && p.imagenes.length > 0 ? p.imagenes[0] : null,
    provider: "Elit",
  }));
}
