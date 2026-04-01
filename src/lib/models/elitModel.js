// web/src/lib/models/elitModel.js
//
// Normaliza productos de la API de Elit al esquema unificado.
// Usa múltiples candidatos de campo para tolerar variaciones de la API.

function pick(p, keys) {
  for (const k of keys) {
    const v = p[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

export function formatElitProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];

  return rawProducts
    .map((p) => {
      // SKU: múltiples candidatos para tolerar variaciones de campo
      const rawSku = pick(p, [
        "codigo_producto", "codigo_produto", "codigo_alfa", "codigo", "sku", "part_number",
      ]);
      const sku = String(rawSku ?? "").trim();
      if (!sku) return null; // descartar productos sin SKU

      // Precio: usar precio de costo. Si es 0, intentar pvp_usd/pvp_ars como fallback.
      const rawPrice  = Number(p.precio) || 0;
      const currency  = Number(p.moneda) === 1 ? "ARS" : "USD";

      const price = rawPrice > 0
        ? rawPrice
        : currency === "USD"
          ? Number(p.pvp_usd) || 0
          : Number(p.pvp_ars) || 0;

      // IVA como string "21%"
      const ivaNum = Number(p.iva);
      const iva    = ivaNum > 0 ? `${ivaNum}%` : "21%";

      // Stock
      const stockTotal = Number(p.stock_total) || 0;

      // Imagen: primer elemento del array imagenes
      let image = null;
      if (Array.isArray(p.imagenes) && p.imagenes.length > 0) {
        image = p.imagenes[0] ?? null;
      } else if (typeof p.imagenes === "string" && p.imagenes) {
        image = p.imagenes;
      }

      return {
        sku,
        name:       String(p.nombre ?? p.descripcion ?? "").trim(),
        brand:      String(p.marca ?? "").trim(),
        price,
        iva,
        currency,
        stockLevel: String(p.nivel_stock ?? "Sin info"),
        stockTotal,
        link:       String(p.link ?? "").trim(),
        image,
        provider:   "Elit",
      };
    })
    .filter(Boolean); // eliminar entradas sin SKU
}
