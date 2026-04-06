// web/src/lib/models/invidModel.js
//
// Normaliza productos de la API de Invid/Jukebox al esquema unificado.
// Todos los valores numéricos vienen como string y se parsean aquí.

// Convierte el STOCK_STATUS de texto a número aproximado para el frontend.
function stockStatusToNumber(raw) {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("sin stock") || s.includes("agotado") || s === "0") return 0;
  if (s.includes("bajo") || s.includes("limitado") || s.includes("poco")) return 5;
  if (s.includes("disponible") || s.includes("en stock") || s.includes("stock")) return 99;
  // Si es numérico directo
  const n = parseInt(s, 10);
  if (!isNaN(n)) return n;
  return 0;
}

export function formatInvidProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .map((p) => {
      const sku = String(p.PART_NUMBER ?? "").trim();
      if (!sku) return null; // descartar productos sin PART_NUMBER

      const price      = parseFloat(p.PRICE) || 0;
      const finalPrice = parseFloat(p.FINAL_PRICE) || 0;

      const ivaNum = parseFloat(p.IVA_PERCENT) || 0;
      const iva    = ivaNum > 0 ? `${ivaNum}%` : "21%";

      const stockLevel = String(p.STOCK_STATUS ?? "Sin info").trim();
      const stockTotal = stockStatusToNumber(p.STOCK_STATUS);

      return {
        sku,
        name:       String(p.TITLE ?? "").trim(),
        brand:      String(p.BRAND ?? "").trim(),
        price:      price > 0 ? price : finalPrice,
        iva,
        currency:   String(p.CURRENCY ?? "ARS").trim().toUpperCase(),
        stockLevel,
        stockTotal,
        link:       "",
        image:      String(p.IMAGE_URL ?? "").trim() || null,
        provider:   "Invid",
      };
    })
    .filter(Boolean);
}
